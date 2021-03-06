﻿var util = require('util');
var EventEmitter = require('events').EventEmitter;
var resourceHandler = require('dvp-ardscommon/ResourceHandler.js');
var redisHandler = require('dvp-ardscommon/RedisHandler.js');
var commonMethods = require('dvp-ardscommon/CommonMethods');
var dbConn = require('dvp-dbmodels');
var fileService = require('./Services/fileService');
var cdrProcessor = require('./Services/cdrProcessor');
var fs = require('fs');
var json2csv = require('json2csv');
var Promise = require('bluebird');
var logger = require('dvp-common/LogHandler/CommonLogHandler.js').logger;
var deepcopy = require('deepcopy');
var messageFormatter = require('dvp-common/CommonMessageGenerator/ClientMessageJsonFormatter.js');
var Q = require('q');
var moment = require('moment');
var notificationService = require('./Services/NotificationService');

var ProcessResourceData = function(logkey,resource, callback){
    //var e = new EventEmitter();
    //process.nextTick(function () {
        if (resource) {
            //var count = 0;
            //for (var i in resourcelist) {
                //var resource = resourcelist[i].Obj;
                var companyStr =resource.Company.toString();
                var tenantStr =resource.Tenant.toString();
                var concurrencyTags = ["company_" + companyStr, "tenant_" + tenantStr, "resourceid_"+resource.ResourceId,"objtype_ConcurrencyInfo"];
                redisHandler.SearchObj_T(logkey,concurrencyTags,function(cErr, cResult){
                        var tempConcurrencyInfos = [];
                        var pcd = ProcessConcurrencyData(logkey,cResult);
                        pcd.on('concurrencyInfo', function (obj) {
                            tempConcurrencyInfos.push(obj);
                        });
                        pcd.on('endConcurrencyInfo', function () {
                            //count++;
                            resource.ConcurrencyInfo = tempConcurrencyInfos;
                            callback(resource);
                        });
                });
            //}
        }
        else {
            //e.emit('endResourceInfo');
            callback(resource);
        }
    //});

    //return (e);
};

var GetResourceStatus = function(logkey,resource, callback){
    var statusKey = util.format("ResourceState:%d:%d:%d", resource.Company, resource.Tenant, resource.ResourceId);
    redisHandler.GetObj(logkey,statusKey,function(sErr,sResult){
        resource.Status = JSON.parse(sResult);
        callback(resource);
    });
};

var ProcessCsData = function(logkey, concurrencyInfo, callback){
    var csTags = ["company_" + concurrencyInfo.Company.toString(), "tenant_" + concurrencyInfo.Tenant.toString(),"handlingType_"+concurrencyInfo.HandlingType, "resourceid_"+concurrencyInfo.ResourceId,"objtype_CSlotInfo"];
    redisHandler.SearchObj_T(logkey,csTags,function(csErr, csResult){
        concurrencyInfo.SlotInfo = csResult;
        callback(concurrencyInfo);
    });
};

var ProcessConcurrencyData = function(logkey,concurrencyInfos){
    var e = new EventEmitter();
    process.nextTick(function () {
        if (Array.isArray(concurrencyInfos) && concurrencyInfos.length>0) {
            var count = 0;
            for (var i in concurrencyInfos) {
                var concurrencyInfo = concurrencyInfos[i];
                //var csTags = ["company_" + concurrencyInfo.Company.toString(), "tenant_" + concurrencyInfo.Tenant.toString(),"handlingType_"+concurrencyInfo.HandlingType, "resourceid_"+concurrencyInfo.ResourceId,"objtype_CSlotInfo"];
                ProcessCsData(logkey,concurrencyInfo,function(concurrencyInfo){
                    count++;
                    e.emit('concurrencyInfo', concurrencyInfo);
                    if (concurrencyInfos.length === count) {
                        e.emit('endConcurrencyInfo');
                    }
                });
            }
        }
        else {
            e.emit('endConcurrencyInfo');
        }
    });

    return (e);
};

var SearchResourceByTags = function (logkey, searchTags, callback) {
    redisHandler.SearchObj_V_T(logkey, searchTags, function (err, result) {
        if (err) {
            console.log(err);
            callback(err, []);
        }
        else {
            var tempResourceInfos = [];
            var count = 0;
            if(result && result.length >0) {
                for (var i in result) {
                    var resource = result[i].Obj;
                    GetResourceStatus(logkey, resource, function (res) {
                        ProcessResourceData(logkey, res, function (tempResource) {
                            count++;
                            tempResourceInfos.push(tempResource);
                            if (count == result.length) {
                                callback(null, tempResourceInfos);
                            }
                        });
                    });
                }
            }else{
                callback(null, tempResourceInfos);
            }
        }
    });
};

var GetAllResources = function (logkey, company, tenant, callback) {
    var searchTags = ["company_" + company, "tenant_" + tenant, "objtype_Resource"];
    SearchResourceByTags(logkey, searchTags, function (err, returnlist) {
        callback(err, returnlist);
    });
};

var GetResourcesBySkills = function (logkey, company, tenant, skills, callback) {
    var searchTags = ["company_" + company, "tenant_" + tenant, "objtype_Resource"];
    var sortedAttributes = commonMethods.sortData(skills);
    for (var k in sortedAttributes) {
        searchTags.push("attribute_" + sortedAttributes[k]);
    }


    SearchResourceByTags(logkey, searchTags, function (err, returnlist) {
        callback(err, returnlist);
    });
};

var GetResourceFilterByClassTypeCategory = function (logkey, company, tenant, resClass, resType, resCategory, callback) {
    var searchTags = ["company_" + company, "tenant_" + tenant, "class_" + resClass, "type_" + resType, "category_" + resCategory, "objtype_Resource"];
    SearchResourceByTags(logkey, searchTags, function (err, returnlist) {
        callback(err, returnlist);
    });
};

var FileCheckAndDelete = function(company, tenant, filename) {
    return new Promise(function(fulfill, reject)
    {
        fileService.GetFileMetadata(company, tenant, filename, function(err, fileData)
        {
            if(fileData)
            {
                fileService.DeleteFile(company, tenant, fileData.UniqueId, function (err, delResp)
                {
                    if (err)
                    {
                        reject(err);

                    }
                    else
                    {
                        fulfill(true);
                    }

                });
            }
            else
            {
                if(err)
                {
                    reject(err);
                }
                else
                {
                    fulfill(true);
                }
            }
        })

    })

};

var convertToMMSS = function (sec) {
    var minutes = Math.floor(sec / 60);

    if (minutes < 10) {
        minutes = '0' + minutes;
    }

    var seconds = sec - minutes * 60;

    if (seconds < 10) {
        seconds = '0' + seconds;
    }

    return minutes + ':' + seconds;
};


var GetResourceStatusDurationList = function(startTime, endTime, resourceId, companyId, tenantId, pageNo, rowCount, skill, callback) {
    var emptyArr = [];
    try
    {
        var offset = (pageNo - 1) * rowCount;

        if(skill)
        {
            dbConn.SequelizeConn.query('SELECT "DB_RES_ResourceAcwInfos"."Duration", "DB_RES_ResourceAcwInfos"."SessionId", "DB_RES_ResourceAcwInfos"."CompanyId", "DB_RES_ResourceAcwInfos"."TenantId", "DB_RES_ResourceAcwInfos"."createdAt", "CSDB_CallCDRProcesseds"."SipFromUser", "CSDB_CallCDRProcesseds"."SipToUser", "CSDB_CallCDRProcesseds"."DVPCallDirection", "CSDB_CallCDRProcesseds"."AgentSkill", "CSDB_CallCDRProcesseds"."HangupParty" FROM "DB_RES_ResourceAcwInfos" INNER JOIN "CSDB_CallCDRProcesseds" ON ("DB_RES_ResourceAcwInfos"."SessionId" = "CSDB_CallCDRProcesseds"."Uuid") WHERE (("DB_RES_ResourceAcwInfos"."CompanyId" = ' + companyId + ' AND "DB_RES_ResourceAcwInfos"."TenantId" = ' + tenantId + ' AND "CSDB_CallCDRProcesseds"."AgentSkill" = \'' + skill + '\' AND "DB_RES_ResourceAcwInfos"."ResourceId" = ' + resourceId + ' AND "DB_RES_ResourceAcwInfos"."createdAt" BETWEEN \'' + startTime + '\' AND \'' + endTime + '\')) ORDER BY "DB_RES_ResourceAcwInfos"."createdAt" LIMIT ' + rowCount + ' OFFSET ' + offset + ';')
                .then(function(acwInfo)
                {
                    if(acwInfo && acwInfo.length > 0)
                    {
                        callback(null, acwInfo[0])
                    }
                    else
                    {
                        callback(null, emptyArr)
                    }
                })
                .catch(function(err)
                {
                    callback(err, emptyArr)
                });
        }
        else
        {
            dbConn.SequelizeConn.query('SELECT "DB_RES_ResourceAcwInfos"."Duration", "DB_RES_ResourceAcwInfos"."SessionId", "DB_RES_ResourceAcwInfos"."CompanyId", "DB_RES_ResourceAcwInfos"."TenantId", "DB_RES_ResourceAcwInfos"."createdAt", "CSDB_CallCDRProcesseds"."SipFromUser", "CSDB_CallCDRProcesseds"."SipToUser", "CSDB_CallCDRProcesseds"."DVPCallDirection", "CSDB_CallCDRProcesseds"."AgentSkill", "CSDB_CallCDRProcesseds"."HangupParty" FROM "DB_RES_ResourceAcwInfos" INNER JOIN "CSDB_CallCDRProcesseds" ON ("DB_RES_ResourceAcwInfos"."SessionId" = "CSDB_CallCDRProcesseds"."Uuid") WHERE (("DB_RES_ResourceAcwInfos"."CompanyId" = ' + companyId + ' AND "DB_RES_ResourceAcwInfos"."TenantId" = ' + tenantId + ' AND "DB_RES_ResourceAcwInfos"."ResourceId" = ' + resourceId + ' AND "DB_RES_ResourceAcwInfos"."createdAt" BETWEEN \'' + startTime + '\' AND \'' + endTime + '\')) ORDER BY "DB_RES_ResourceAcwInfos"."createdAt" LIMIT ' + rowCount + ' OFFSET ' + offset + ';')
                .then(function(acwInfo)
                {
                    if(acwInfo && acwInfo.length > 0)
                    {
                        callback(null, acwInfo[0])
                    }
                    else
                    {
                        callback(null, emptyArr)
                    }
                })
                .catch(function(err)
                {
                    callback(err, emptyArr)
                });
        }



        /*var defaultQuery = {where :[{CompanyId: companyId, TenantId: tenantId, ResourceId: resourceId, StatusType: 'SloatStatus', Status: 'AfterWork', createdAt: {between:[startTime, endTime]}}],
            offset: ((pageNo - 1) * rowCount),
            limit: rowCount,
            order: ['createdAt']};


        dbConn.ResResourceStatusDurationInfo.findAll(defaultQuery).then(function(resourceInfoList)
        {
            callback(null, resourceInfoList)

        }).catch(function(err)
        {
            callback(err, emptyArr)
        });*/

    }
    catch(ex)
    {
        callback(ex, emptyArr);
    }
};

var GetResourceStatusDurationSummery = function(startTime, endTime, resourceId, companyId, tenantId, skill, callback) {
    var emptyArr = [];
    try
    {
        if(skill)
        {
            dbConn.SequelizeConn.query('SELECT COUNT("DB_RES_ResourceAcwInfos"."Duration") AS "TotalAcwSessions", SUM("DB_RES_ResourceAcwInfos"."Duration") AS "TotalAcwTime", AVG("DB_RES_ResourceAcwInfos"."Duration") AS "AverageAcwTime" FROM "DB_RES_ResourceAcwInfos" INNER JOIN "CSDB_CallCDRProcesseds" ON ("DB_RES_ResourceAcwInfos"."SessionId" = "CSDB_CallCDRProcesseds"."Uuid") WHERE (("DB_RES_ResourceAcwInfos"."CompanyId" = ' + companyId + ' AND "DB_RES_ResourceAcwInfos"."TenantId" = ' + tenantId + ' AND "CSDB_CallCDRProcesseds"."AgentSkill" = \'' + skill + '\' AND "DB_RES_ResourceAcwInfos"."ResourceId" = ' + resourceId + ' AND "DB_RES_ResourceAcwInfos"."createdAt" BETWEEN \'' + startTime + '\' AND \'' + endTime + '\'));')
                .then(function(acwInfo)
                {
                    if(acwInfo && acwInfo.length > 0)
                    {
                        callback(null, acwInfo[0][0])
                    }
                    else
                    {
                        callback(null, emptyArr)
                    }
                })
                .catch(function(err)
                {
                    callback(err, emptyArr)
                });
        }
        else
        {
            dbConn.SequelizeConn.query('SELECT COUNT("DB_RES_ResourceAcwInfos"."Duration") AS "TotalAcwSessions", SUM("DB_RES_ResourceAcwInfos"."Duration") AS "TotalAcwTime", AVG("DB_RES_ResourceAcwInfos"."Duration") AS "AverageAcwTime" FROM "DB_RES_ResourceAcwInfos" INNER JOIN "CSDB_CallCDRProcesseds" ON ("DB_RES_ResourceAcwInfos"."SessionId" = "CSDB_CallCDRProcesseds"."Uuid") WHERE (("DB_RES_ResourceAcwInfos"."CompanyId" = ' + companyId + ' AND "DB_RES_ResourceAcwInfos"."TenantId" = ' + tenantId + ' AND "DB_RES_ResourceAcwInfos"."ResourceId" = ' + resourceId + ' AND "DB_RES_ResourceAcwInfos"."createdAt" BETWEEN \'' + startTime + '\' AND \'' + endTime + '\'));')
                .then(function(acwInfo)
                {
                    if(acwInfo && acwInfo.length > 0)
                    {
                        callback(null, acwInfo[0][0])
                    }
                    else
                    {
                        callback(null, emptyArr)
                    }
                })
                .catch(function(err)
                {
                    callback(err, emptyArr)
                });
        }


        /*var defaultQuery = {
            attributes: [[dbConn.SequelizeConn.fn('COUNT', dbConn.SequelizeConn.col('*')), 'TotalAcwSessions'],[dbConn.SequelizeConn.fn('SUM', dbConn.SequelizeConn.col('Duration')), 'TotalAcwTime'],[dbConn.SequelizeConn.fn('AVG', dbConn.SequelizeConn.col('Duration')), 'AverageAcwTime']],
            where :[{CompanyId: companyId, TenantId: tenantId, ResourceId: resourceId, StatusType: 'SloatStatus', Status: 'AfterWork', createdAt: {between:[startTime, endTime]}}]
        };


        dbConn.ResResourceStatusDurationInfo.find(defaultQuery).then(function(resourceInfoList)
        {
            callback(null, resourceInfoList)

        }).catch(function(err)
        {
            callback(err, emptyArr)
        });*/

    }
    catch(ex)
    {
        callback(ex, emptyArr);
    }
};

var GetResourceRejectSummery = function(startTime, endTime, resourceId, companyId, tenantId, pageNo, rowCount, callback) {
    var emptyArr = [];
    try
    {
        var rejectSessionQuery = {
            attributes: [[dbConn.SequelizeConn.fn('DISTINCT', dbConn.SequelizeConn.col('SessionId')), 'SessionId']],
            where : [{ResourceId: resourceId, createdAt: {between:[startTime, endTime]}}],
            offset: ((pageNo - 1) * rowCount),
            limit: rowCount
        };




        dbConn.ResResourceTaskRejectInfo.findAll(rejectSessionQuery).then(function(rejectSessionList)
        {
            var sessionIdList = [];
            rejectSessionList.forEach(function(session){
                if(session && session.dataValues && session.dataValues.SessionId) {
                    sessionIdList.push(session.dataValues.SessionId);
                }
            });

            var rejectDetailQuery = {
                attributes: ['TenantId', 'CompanyId', 'ResourceId', 'Task', 'SessionId',[dbConn.SequelizeConn.fn('COUNT', dbConn.SequelizeConn.col('SessionId')), 'RejectCount']],
                where : [{SessionId: {$in:sessionIdList}, ResourceId: resourceId}],
                group: ['TenantId', 'CompanyId', 'ResourceId', 'Task', 'SessionId']
            };

            dbConn.ResResourceTaskRejectInfo.findAll(rejectDetailQuery).then(function(resourceRejectList)
            {
                callback(null, resourceRejectList)

            }).catch(function(err)
            {
                callback(err, emptyArr)
            });

        }).catch(function(err)
        {
            callback(err, emptyArr)
        });




    }
    catch(ex)
    {
        callback(ex, emptyArr);
    }
};

var GetResourceRejectCount = function(startTime, endTime, resourceId, companyId, tenantId, callback) {
    try
    {
        var rejectSessionQuery = {
            attributes: [[dbConn.SequelizeConn.fn('DISTINCT', dbConn.SequelizeConn.col('SessionId')), 'TotalRejectedSessions']],
            where : [{ResourceId: resourceId, createdAt: {between:[startTime, endTime]}}]
        };




        dbConn.ResResourceTaskRejectInfo.findAll(rejectSessionQuery).then(function(rejectSessions)
        {
            if(rejectSessions){
                callback(null, rejectSessions.length)
            }else {
                callback(null, 0);
            }

        }).catch(function(err)
        {
            callback(err, 0)
        });




    }
    catch(ex)
    {
        callback(ex, 0);
    }
};

var PrepareForDownloadResourceRejectSummery = function(startTime, endTime, resourceId, companyId, tenantId, res) {
    var jsonString;
    try
    {
        var fileName = util.format('MissedCallReport_%s.csv', resourceId);

        FileCheckAndDelete(companyId, tenantId, fileName).then(function(chkResult) {
                if(chkResult) {

                    fileService.FileUploadReserve(companyId, tenantId, fileName, function(err, fileResResp)
                    {
                        if (err) {
                            jsonString = messageFormatter.FormatMessage(err, "ERROR", false, null);
                            logger.debug('[DVP-CDRProcessor.DownloadCDR] - API RESPONSE : %s', jsonString);
                            res.end(jsonString);
                        } else {
                            if(fileResResp) {
                                var uniqueId = fileResResp.Result;

                                //should respose end
                                jsonString = messageFormatter.FormatMessage(null, "SUCCESS", true, fileName);
                                logger.debug('[DVP-CDRProcessor.DownloadCDR] - API RESPONSE : %s', jsonString);
                                res.end(jsonString);


                                var rejectSessionQuery = {
                                    attributes: [[dbConn.SequelizeConn.fn('DISTINCT', dbConn.SequelizeConn.col('SessionId')), 'SessionId']],
                                    where : [{ResourceId: resourceId, createdAt: {between:[startTime, endTime]}}]
                                };

                                dbConn.ResResourceTaskRejectInfo.findAll(rejectSessionQuery).then(function(rejectSessionList)
                                {
                                    var sessionIdList = [];
                                    rejectSessionList.forEach(function(session){
                                        if(session && session.dataValues && session.dataValues.SessionId) {
                                            sessionIdList.push(session.dataValues.SessionId);
                                        }
                                    });

                                    var rejectDetailQuery = {
                                        attributes: ['TenantId', 'CompanyId', 'ResourceId', 'Task', 'SessionId',[dbConn.SequelizeConn.fn('COUNT', dbConn.SequelizeConn.col('SessionId')), 'RejectCount']],
                                        where : [{SessionId: {$in:sessionIdList}, ResourceId: resourceId}],
                                        group: ['TenantId', 'CompanyId', 'ResourceId', 'Task', 'SessionId']
                                    };

                                    dbConn.ResResourceTaskRejectInfo.findAll(rejectDetailQuery).then(function(resourceRejectList)
                                    {
                                        cdrProcessor.GetCdrBySessions(companyId, tenantId, sessionIdList, function (err, response) {
                                            if (err) {
                                                fileService.DeleteFile(companyId, tenantId, uniqueId, function(err, delData){
                                                    if(err) {
                                                        logger.error('[DVP-CDRProcessor.DownloadCDR] - Delete Failed : %s', err);
                                                    }
                                                });
                                            } else {
                                                if(response.IsSuccess)
                                                {

                                                    var newRecords = resourceRejectList.map(function (missedCallRecord) {
                                                        if(response.Result) {
                                                            for (var i = 0; i < response.Result.length; i++) {
                                                                var cdrRecord = response.Result[i];
                                                                if (cdrRecord.Uuid === missedCallRecord.SessionId) {
                                                                    cdrRecord.QueueSec = convertToMMSS(cdrRecord.QueueSec);
                                                                    if (cdrRecord.DVPCallDirection === "outbound") {
                                                                        var oriFrom = deepcopy(cdrRecord.SipFromUser);
                                                                        var oriTo = deepcopy(cdrRecord.SipToUser);
                                                                        cdrRecord.SipFromUser = oriTo;
                                                                        cdrRecord.SipToUser = oriFrom;
                                                                    }
                                                                    missedCallRecord.RejectCount = missedCallRecord.dataValues.RejectCount;
                                                                    missedCallRecord.CreatedTime = cdrRecord.CreatedTime;
                                                                    missedCallRecord.AgentSkill = cdrRecord.AgentSkill;
                                                                    missedCallRecord.QueueSec = cdrRecord.QueueSec;
                                                                    missedCallRecord.SipFromUser = cdrRecord.SipFromUser;
                                                                    missedCallRecord.SipToUser = cdrRecord.SipToUser;
                                                                    missedCallRecord.AgentAnswered = cdrRecord.AgentAnswered;
                                                                    missedCallRecord.RecievedBy = cdrRecord.RecievedBy;
                                                                    break;
                                                                }
                                                            }
                                                        }

                                                        return missedCallRecord;
                                                    });


                                                    var tagHeaders = ['SessionId', 'Call Time', 'Skill', 'Queue Duration', 'Reject Count', 'From', 'To', 'Agent Answered', 'Received By'];
                                                    var tagOrder = ['SessionId', 'CreatedTime', 'AgentSkill', 'QueueSec', 'RejectCount', 'SipFromUser', 'SipToUser', 'AgentAnswered', 'RecievedBy'];


                                                    var csvFileData = json2csv({ data: newRecords, fields: tagOrder, fieldNames : tagHeaders });

                                                    fs.writeFile(fileName, csvFileData, function(err) {
                                                        if (err) {
                                                            fileService.DeleteFile(companyId, tenantId, uniqueId, function(err, delData){
                                                                if(err) {
                                                                    logger.error('[DVP-CDRProcessor.DownloadCDR] - Delete Failed : %s', err);
                                                                }
                                                            });
                                                        } else {

                                                            var formData = {
                                                                class: 'MISSEDCALL',
                                                                fileCategory:'REPORTS',
                                                                display: fileName,
                                                                filename: fileName,
                                                                attachments: [
                                                                    fs.createReadStream(fileName)
                                                                ]

                                                            };

                                                            fileService.UploadFile(companyId, tenantId, uniqueId, formData, function(err, uploadResp) {
                                                                fs.unlink(fileName);
                                                                if(!err && uploadResp) {

                                                                } else {
                                                                    fileService.DeleteFile(companyId, tenantId, uniqueId, function(err, delData){
                                                                        if(err) {
                                                                            logger.error('[DVP-CDRProcessor.DownloadCDR] - Delete Failed : %s', err);
                                                                        }
                                                                    });
                                                                }

                                                            });

                                                        }
                                                    });

                                                } else {
                                                    fileService.DeleteFile(companyId, tenantId, uniqueId, function(err, delData){
                                                        if(err) {
                                                            logger.error('[DVP-CDRProcessor.DownloadCDR] - Delete Failed : %s', err);
                                                        }
                                                    });
                                                }
                                            }
                                        });

                                    }).catch(function(err)
                                    {
                                        fileService.DeleteFile(companyId, tenantId, uniqueId, function(err, delData){
                                            if(err) {
                                                logger.error('[DVP-CDRProcessor.DownloadCDR] - Delete Failed : %s', err);
                                            }
                                        });
                                    });

                                }).catch(function(err)
                                {
                                    fileService.DeleteFile(companyId, tenantId, uniqueId, function(err, delData){
                                        if(err) {
                                            logger.error('[DVP-CDRProcessor.DownloadCDR] - Delete Failed : %s', err);
                                        }
                                    });
                                });

                            } else {

                                jsonString = messageFormatter.FormatMessage(new Error('Failed to reserve file'), "ERROR", false, null);
                                logger.debug('[DVP-CDRProcessor.DownloadCDR] - API RESPONSE : %s', jsonString);
                                res.end(jsonString);

                            }

                        }
                    });

                }else {
                    jsonString = messageFormatter.FormatMessage(new Error('Error deleting file'), "ERROR", false, null);
                    logger.debug('[DVP-CDRProcessor.PrepareDownloadAbandon] - API RESPONSE : %s', jsonString);
                    res.end(jsonString);
                }
            }).catch(function(err)
            {
                jsonString = messageFormatter.FormatMessage(err, "ERROR", false, null);
                logger.debug('[DVP-CDRProcessor.PrepareDownloadAbandon] - API RESPONSE : %s', jsonString);
                res.end(jsonString);
            });






    }
    catch(ex)
    {
        jsonString = messageFormatter.FormatMessage(ex, "ERROR", false, null);
        logger.debug('[DVP-CDRProcessor.PrepareDownloadAbandon] - API RESPONSE : %s', jsonString);
        res.end(jsonString);
    }
};



//-------------------------Resource Status Event Publish-----------------------------------------------

var getObjByKey = function (key) {
    var deferred = Q.defer();

    try {
        redisHandler.GetObj('getObjByKey', key, function (err, result) {
            if (err) {
                deferred.reject(err);
            } else {
                if(result) {
                    deferred.resolve(JSON.parse(result));
                }else{
                    deferred.reject(new Error('No Value Found'));
                }
            }
        });
    }catch(ex){
        deferred.reject(ex);
    }
    return deferred.promise;
};

var getMultipleObjByKeys = function (keys) {
    var deferred = Q.defer();

    try {
        redisHandler.MGetObj('getMultipleObjByKeys', keys, function (err, results) {
            if (err) {
                deferred.reject(err);
            } else {
                var convertedResults = [];
                results.forEach(function (result) {

                    if(result){
                        convertedResults.push(JSON.parse(result));
                    }
                });
                deferred.resolve(convertedResults);
            }
        });
    }catch(ex){
        deferred.reject(ex);
    }
    return deferred.promise;
};

var SetAndPublishResourceStatus = function (req, res) {

    var company = parseInt(req.user.company);
    var tenant = parseInt(req.user.tenant);
    var resourceId = req.params.resourceId;

    var resourceName = req.query.resourceName? req.query.resourceName: undefined;
    var statusType = req.query.statusType? req.query.statusType: undefined;
    var removeTask = req.query.task? req.query.task: undefined;

    res.writeHead(202);
    res.end(messageFormatter.FormatMessage(undefined, "Resource status publish accepted by server", true, undefined));

    if(statusType && resourceName && statusType === 'removeResource'){

        var resourceData = {
            resourceId: resourceId,
            resourceName: resourceName
        };
        var resource_postData = {message: resourceData, From: 'ArdsMonitoringService'};
        notificationService.RequestToNotify(company, tenant, 'ARDS:RemoveResource', 'RemoveResource', resource_postData);

    }else {


        var resourceKey = util.format('Resource:%d:%d:%s', company, tenant, resourceId);
        var resourceObj = {};
        var publishProfiles = [];

        getObjByKey(resourceKey).then(function (resource) {

            var resourceStateKey = util.format('ResourceState:%d:%d:%s', resource.Company, resource.Tenant, resource.ResourceId);
            var nextResourceKeys = resource.ConcurrencyInfo;

            nextResourceKeys.push(resourceStateKey);
            resourceObj = resource;

            return getMultipleObjByKeys(nextResourceKeys);

        }).then(function (results) {

            if (results && results.length > 0) {

                var statusData = results.filter(function (result) {
                    return !result.ObjKey;
                });

                if (statusData && statusData.length > 0) {
                    resourceObj.Status = statusData[0];
                } else {
                    resourceObj.Status = undefined;
                }

                if(statusType && removeTask && resourceName && statusType === 'removeTask'){

                    var date = new Date();

                    var taskData = {
                        resourceId: resourceId,
                        resourceName: resourceName,
                        userName: resourceObj.UserName,
                        task: removeTask,
                        slotState: "Other",
                        slotMode: resourceObj.Status.Mode,
                        LastReservedTime: moment(date.toISOString()).format("h:mm a"),
                        LastReservedTimeT: date.toISOString(),
                        other: "Offline"
                    };
                    var task_postData = {message: taskData, From: 'ArdsMonitoringService'};
                    notificationService.RequestToNotify(company, tenant, 'ARDS:RemoveResourceTask', 'RemoveResourceTask', task_postData);

                }else {

                    if (resourceObj.LoginTasks && resourceObj.LoginTasks.length > 0 && resourceObj.Status) {

                        resourceObj.LoginTasks.forEach(function (task) {

                            var concurrencyAndSlotData = results.filter(function (result) {
                                return result.HandlingType && result.HandlingType === task;
                            });

                            if (concurrencyAndSlotData && concurrencyAndSlotData.length > 0) {
                                var concurrencyData = concurrencyAndSlotData.filter(function (csData) {
                                    return csData.ObjKey.indexOf('ConcurrencyInfo') > -1;
                                });

                                if (concurrencyData && concurrencyData.length > 0) {

                                    var concurrencyDetail = concurrencyData[0];


                                    if (concurrencyDetail.IsRejectCountExceeded) {

                                        publishProfiles.push({
                                            resourceId: resourceId,
                                            resourceName: resourceObj.ResourceName,
                                            userName: resourceObj.UserName,
                                            task: task,
                                            slotState: "Suspended",
                                            slotMode: resourceObj.Status.Mode,
                                            LastReservedTime: moment(concurrencyDetail.LastConnectedTime).format("h:mm a"),
                                            LastReservedTimeT: concurrencyDetail.LastConnectedTime,
                                            other: "Reject"
                                        });

                                    } else if (resourceObj.Status.State == "NotAvailable" && resourceObj.Status.Reason.toLowerCase().indexOf("break") > -1) {

                                        publishProfiles.push({
                                            resourceId: resourceId,
                                            resourceName: resourceObj.ResourceName,
                                            userName: resourceObj.UserName,
                                            task: task,
                                            slotState: resourceObj.Status.Reason,
                                            slotMode: resourceObj.Status.Mode,
                                            LastReservedTime: moment(resourceObj.Status.StateChangeTime).format("h:mm a"),
                                            LastReservedTimeT: resourceObj.Status.StateChangeTime,
                                            other: "Break"
                                        });

                                    } else {

                                        var slotData = concurrencyAndSlotData.filter(function (csData) {
                                            return csData.ObjKey.indexOf('CSlotInfo') > -1;
                                        });

                                        if (slotData && slotData.length > 0) {

                                            slotData.forEach(function (slot) {
                                                publishProfiles.push({
                                                    resourceId: resourceId,
                                                    resourceName: resourceObj.ResourceName,
                                                    userName: resourceObj.UserName,
                                                    task: task,
                                                    slotState: slot.State,
                                                    slotMode: resourceObj.Status.Mode,
                                                    LastReservedTime: moment(slot.StateChangeTime).format("h:mm a"),
                                                    LastReservedTimeT: slot.StateChangeTime,
                                                    other: null
                                                });
                                            });

                                        } else {

                                            publishProfiles.push({
                                                resourceId: resourceId,
                                                resourceName: resourceObj.ResourceName,
                                                userName: resourceObj.UserName,
                                                task: task,
                                                slotState: "Other",
                                                slotMode: resourceObj.Status.Mode,
                                                LastReservedTime: moment(resourceObj.Status.StateChangeTime).format("h:mm a"),
                                                LastReservedTimeT: resourceObj.Status.StateChangeTime,
                                                other: "Offline"
                                            });

                                        }

                                    }

                                } else {
                                    publishProfiles.push({
                                        resourceId: resourceId,
                                        resourceName: resourceObj.ResourceName,
                                        userName: resourceObj.UserName,
                                        task: task,
                                        slotState: "Other",
                                        slotMode: resourceObj.Status.Mode,
                                        LastReservedTime: moment(resourceObj.Status.StateChangeTime).format("h:mm a"),
                                        LastReservedTimeT: resourceObj.Status.StateChangeTime,
                                        other: "Offline"
                                    });
                                }
                            } else {
                                publishProfiles.push({
                                    resourceId: resourceId,
                                    resourceName: resourceObj.ResourceName,
                                    userName: resourceObj.UserName,
                                    task: task,
                                    slotState: "Other",
                                    slotMode: resourceObj.Status.Mode,
                                    LastReservedTime: moment(resourceObj.Status.StateChangeTime).format("h:mm a"),
                                    LastReservedTimeT: resourceObj.Status.StateChangeTime,
                                    other: "Offline"
                                });
                            }

                        });

                    } else {
                        if (resourceObj.Status) {

                            var offlineProfile = {
                                resourceId: resourceId,
                                resourceName: resourceObj.ResourceName,
                                userName: resourceObj.UserName,
                                task: '',
                                slotState: "Other",
                                slotMode: resourceObj.Status.Mode,
                                LastReservedTime: moment(resourceObj.Status.StateChangeTime).format("h:mm a"),
                                LastReservedTimeT: resourceObj.Status.StateChangeTime,
                                other: "Offline"
                            };

                            if (resourceObj.Status.State == "NotAvailable" && resourceObj.Status.Reason.toLowerCase().indexOf("break") > -1) {
                                offlineProfile.slotState = resourceObj.Status.Reason;
                                offlineProfile.other = "Break";
                            }

                            publishProfiles.push(offlineProfile);

                        } else {
                            logger.info('No Resource Status Found - ' + resourceObj.ResourceId);
                        }
                    }
                }
            }

            logger.info(JSON.stringify(publishProfiles));

            if (publishProfiles) {
                publishProfiles.forEach(function (profile) {
                    var postData = {message: profile, From: 'ArdsMonitoringService'};
                    notificationService.RequestToNotify(company, tenant, 'ARDS:ResourceStatus', 'ResourceStatus', postData);
                });
            }

        }).catch(function (err) {

            logger.error('Error on evaluating resource object');

        });
    }

};

module.exports.GetAllResources = GetAllResources;
module.exports.GetResourceFilterByClassTypeCategory = GetResourceFilterByClassTypeCategory;
module.exports.GetResourcesBySkills = GetResourcesBySkills;
module.exports.GetResourceStatusDurationList = GetResourceStatusDurationList;
module.exports.GetResourceStatusDurationSummery = GetResourceStatusDurationSummery;
module.exports.GetResourceRejectSummery = GetResourceRejectSummery;
module.exports.GetResourceRejectCount = GetResourceRejectCount;
module.exports.PrepareForDownloadResourceRejectSummery = PrepareForDownloadResourceRejectSummery;
module.exports.SetAndPublishResourceStatus = SetAndPublishResourceStatus;