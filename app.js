﻿var restify = require('restify');
var util = require('util');
var uuid = require('node-uuid');
var requsetMonitor = require('./RequestMonitor.js');
var resourceMonitor = require('./ResourceMonitor.js');
var callCenterMonitor = require('./CallCenterMonitor.js');
var infoLogger = require('dvp-ardscommon/InformationLogger.js');
var authHandler = require('dvp-ardscommon/Authorization.js');
var config = require('config');
var messageFormatter = require('dvp-common/CommonMessageGenerator/ClientMessageJsonFormatter.js');
var jwt = require('restify-jwt');
var secret = require('dvp-common/Authentication/Secret.js');
var authorization = require('dvp-common/Authentication/Authorization.js');
var logger = require('dvp-common/LogHandler/CommonLogHandler.js').logger;

var server = restify.createServer({
    name: 'ArdsMonitoringAPI',
    version: '1.0.0'
});
server.pre(restify.pre.userAgentConnection());
restify.CORS.ALLOW_HEADERS.push('authorization');
server.use(restify.CORS());
server.use(restify.fullResponse());
server.use(restify.acceptParser(server.acceptable));
server.use(restify.queryParser());
server.use(restify.bodyParser());
server.use(jwt({secret: secret.Secret}));

var hostIp = config.Host.Ip;
var hostPort = config.Host.Port;
var hostVersion = config.Host.Version;

//--------------------------Request Monitoring---------------------------------------

server.get('/DVP/API/:version/ARDS/MONITORING/requests',authorization({resource:"ardsrequest", action:"read"}), function (req, res, next) {
    try {
            var company = req.user.company;
            var tenant = req.user.tenant;
            var objkey = util.format('request-getall:company_%s:tenant_%s', company, tenant);
            var logkey = util.format('[%s]::[%s]', uuid.v1(), objkey);

            infoLogger.ReqResLogger.log('info', '%s --------------------------------------------------', logkey);
            infoLogger.ReqResLogger.log('info', '%s Start- request/getall #', logkey, {request: req.params});
            requsetMonitor.GetAllRequests(logkey, company, tenant, function (err, result) {
                if (err) {
                    infoLogger.ReqResLogger.log('error', '%s End- request/getall :: Error: %s #', logkey, err);
                    var jsonString = messageFormatter.FormatMessage(err, "ERROR", false, undefined);
                    res.writeHead(500, {'Content-Type': 'application/json; charset=utf-8'});
                    res.end(jsonString);
                }
                else {
                    infoLogger.ReqResLogger.log('info', '%s End- request/getall :: Result: %s #', logkey, 'success');
                    var jsonString = messageFormatter.FormatMessage(err, "get request success", true, result);
                    res.writeHead(200, {'Content-Type': 'application/json; charset=utf-8'});
                    res.end(jsonString);
                }
            });
    } catch (ex2)
    {
        var jsonString = messageFormatter.FormatMessage(ex2, "ERROR", false, undefined);
        res.writeHead(500, {'Content-Type': 'application/json; charset=utf-8'});
        res.end(jsonString);
    }
    return next();
});

server.get('/DVP/API/:version/ARDS/MONITORING/requests/:serverType/:requestType',authorization({resource:"ardsrequest", action:"read"}), function (req, res, next) {
    try {
            var company = req.user.company;
            var tenant = req.user.tenant;
            var data = req.params;
            var objkey = util.format('request-filterBy_serverType_requestType:company_%s:tenant_%s:serverType_%s:requestType_%s', company, tenant, data["serverType"], data["requestType"]);
            var logkey = util.format('[%s]::[%s]', uuid.v1(), objkey);

            infoLogger.ReqResLogger.log('info', '%s --------------------------------------------------', logkey);
            infoLogger.ReqResLogger.log('info', '%s Start- request/getall #', logkey, {request: req.params});
            requsetMonitor.GetRequestFilterByClassTypeCategory(logkey, company, tenant, data["serverType"], data["requestType"], function (err, result) {
                if (err) {
                    infoLogger.ReqResLogger.log('error', '%s End- request/getall :: Error: %s #', logkey, err);
                    var jsonString = messageFormatter.FormatMessage(err, "ERROR", false, undefined);
                    res.writeHead(500, {'Content-Type': 'application/json; charset=utf-8'});
                    res.end(jsonString);
                }
                else {
                    infoLogger.ReqResLogger.log('info', '%s End- request/getall :: Result: %s #', logkey, 'success');
                    var jsonString = messageFormatter.FormatMessage(err, "get request success", true, result);
                    res.writeHead(200, {'Content-Type': 'application/json; charset=utf-8'});
                    res.end(jsonString);
                }
            });
    } catch (ex2) {
        var jsonString = messageFormatter.FormatMessage(ex2, "ERROR", false, undefined);
        res.writeHead(500, {'Content-Type': 'application/json; charset=utf-8'});
        res.end(jsonString);
    }
    return next();
});


//--------------------------Queue Monitoring-----------------------------------------
server.get('/DVP/API/:version/ARDS/MONITORING/queues',authorization({resource:"queue", action:"read"}), function (req, res, next) {
    try {
            var company = req.user.company;
            var tenant = req.user.tenant;
            var objkey = util.format('request-getallQueueDetail:company_%s:tenant_%s', company, tenant);
            var logkey = util.format('[%s]::[%s]', uuid.v1(), objkey);

            infoLogger.ReqResLogger.log('info', '%s --------------------------------------------------', logkey);
            infoLogger.ReqResLogger.log('info', '%s Start- request/getall #', logkey, {request: req.params});
            requsetMonitor.GetAllQueueDetails(logkey, company, tenant, function (err, result) {
                if (err) {
                    infoLogger.ReqResLogger.log('error', '%s End- request/getall :: Error: %s #', logkey, err);
                    var jsonString = messageFormatter.FormatMessage(err, "ERROR", false, undefined);
                    res.writeHead(500, {'Content-Type': 'application/json; charset=utf-8'});
                    res.end(jsonString);
                }
                else {
                    infoLogger.ReqResLogger.log('info', '%s End- request/getall :: Result: %s #', logkey, 'success');
                    var jsonString = messageFormatter.FormatMessage(err, "get QueueInfo success", true, result);
                    res.writeHead(200, {'Content-Type': 'application/json; charset=utf-8'});
                    res.end(jsonString);
                }
            });
    } catch (ex2) {
        var jsonString = messageFormatter.FormatMessage(ex2, "ERROR", false, undefined);
        res.writeHead(500, {'Content-Type': 'application/json; charset=utf-8'});
        res.end(jsonString);
    }
    return next();
});

server.get('/DVP/API/:version/ARDS/MONITORING/queues/:serverType/:requestType',authorization({resource:"queue", action:"read"}), function (req, res, next) {
    try {
            var company = req.user.company;
            var tenant = req.user.tenant;
            var data = req.params;

            var objkey = util.format('queue-filterBysServerTyperRequestType:company_%s:tenant_%s:serverType_%s:requestType_%s', company, tenant, data["serverType"], data["requestType"]);
            var logkey = util.format('[%s]::[%s]', uuid.v1(), objkey);

            infoLogger.ReqResLogger.log('info', '%s --------------------------------------------------', logkey);
            infoLogger.ReqResLogger.log('info', '%s Start- request/getall #', logkey, {request: req.params});
            requsetMonitor.GetQueueDetailsFilterByClassTypeCategory(logkey, company, tenant, data["serverType"], data["requestType"], function (err, result) {
                if (err) {
                    infoLogger.ReqResLogger.log('error', '%s End- request/getall :: Error: %s #', logkey, err);
                    var jsonString = messageFormatter.FormatMessage(err, "ERROR", false, undefined);
                    res.writeHead(500, {'Content-Type': 'application/json; charset=utf-8'});
                    res.end(jsonString);
                }
                else {
                    infoLogger.ReqResLogger.log('info', '%s End- request/getall :: Result: %s #', logkey, 'success');
                    var jsonString = messageFormatter.FormatMessage(err, "get QueueInfo success", true, result);
                    res.writeHead(200, {'Content-Type': 'application/json; charset=utf-8'});
                    res.end(jsonString);
                }
            });
    } catch (ex2) {
        var jsonString = messageFormatter.FormatMessage(ex2, "ERROR", false, undefined);
        res.writeHead(500, {'Content-Type': 'application/json; charset=utf-8'});
        res.end(jsonString);
    }
    return next();
});

server.get('/DVP/API/:version/ARDS/MONITORING/queueName/:queueId',authorization({resource:"queue", action:"read"}), function (req, res, next) {
    try {
        var objkey = util.format('request-getallQueuename: %s', req.params.queueId);
        var logkey = util.format('[%s]::[%s]', uuid.v1(), objkey);

        infoLogger.ReqResLogger.log('info', '%s --------------------------------------------------', logkey);
        infoLogger.ReqResLogger.log('info', '%s Start- getQueueName #', logkey, {request: req.params});
        requsetMonitor.GenerateQueueName(logkey, req.params.queueId, function (err, result) {
            if (err) {
                infoLogger.ReqResLogger.log('error', '%s End- rgetQueueName :: Error: %s #', logkey, err);
                var jsonString = messageFormatter.FormatMessage(err, "ERROR", false, undefined);
                res.writeHead(500, {'Content-Type': 'application/json; charset=utf-8'});
                res.end(jsonString);
            }
            else {
                infoLogger.ReqResLogger.log('info', '%s End- getQueueName :: Result: %s #', logkey, 'success');
                var jsonString = messageFormatter.FormatMessage(err, "get getQueueName success", true, result);
                res.writeHead(200, {'Content-Type': 'application/json; charset=utf-8'});
                res.end(jsonString);
            }
        });
    } catch (ex2) {
        var jsonString = messageFormatter.FormatMessage(ex2, "ERROR", false, undefined);
        res.writeHead(500, {'Content-Type': 'application/json; charset=utf-8'});
        res.end(jsonString);
    }
    return next();
});

server.get('/DVP/API/:version/ARDS/MONITORING/QUEUE/Summary/from/:summaryFromDate/to/:summaryToDate', authorization({
    resource: "queue",
    action: "read"
}), function (req, res, next) {
    try {

        logger.info('[QueueSummaryHandler.GetDailySummaryRecords] - [HTTP]  - Request received -  Data - %s ', JSON.stringify(req.params));

        if (!req.user ||!req.user.tenant || !req.user.company)
            throw new Error("invalid tenant or company.");
        var tenantId = req.user.tenant;
        var companyId = req.user.company;
        requsetMonitor.GetDailySummaryRecords(tenantId, companyId, req.params.summaryFromDate, req.params.summaryToDate, res);
    }
    catch (ex) {
        logger.error('[QueueSummaryHandler.GetDailySummaryRecords] - [HTTP]  - Exception occurred -  Data - %s ', JSON.stringify(req.body), ex);
        var jsonString = messageFormatter.FormatMessage(ex, "EXCEPTION", false, undefined);
        logger.debug('[QueueSummaryHandler.GetDailySummaryRecords] - Request response : %s ', jsonString);
        res.end(jsonString);
    }
    return next();
});

server.get('/DVP/API/:version/ARDS/MONITORING/QUEUE/SlaHourlyBreakDown/date/:summaryDate', authorization({
    resource: "queue",
    action: "read"
}), function (req, res, next) {
    try {

        logger.info('[QueueSummaryHandler.GetQueueSlaHourlyBreakDownRecords] - [HTTP]  - Request received -  Data - %s ', JSON.stringify(req.params));

        if (!req.user ||!req.user.tenant || !req.user.company)
            throw new Error("invalid tenant or company.");
        var tenantId = req.user.tenant;
        var companyId = req.user.company;
        requsetMonitor.GetQueueSlaHourlyBreakDownRecords(tenantId, companyId, req.params.summaryDate, res);
    }
    catch (ex) {
        logger.error('[QueueSummaryHandler.GetQueueSlaHourlyBreakDownRecords] - [HTTP]  - Exception occurred -  Data - %s ', JSON.stringify(req.body), ex);
        var jsonString = messageFormatter.FormatMessage(ex, "EXCEPTION", false, undefined);
        logger.debug('[QueueSummaryHandler.GetQueueSlaHourlyBreakDownRecords] - Request response : %s ', jsonString);
        res.end(jsonString);
    }
    return next();
});

server.get('/DVP/API/:version/ARDS/MONITORING/QUEUE/SlaBreakDown/date/:summaryDate', authorization({
    resource: "queue",
    action: "read"
}), function (req, res, next) {
    try {

        logger.info('[QueueSummaryHandler.GetQueueSlaBreakDownRecords] - [HTTP]  - Request received -  Data - %s ', JSON.stringify(req.params));

        if (!req.user ||!req.user.tenant || !req.user.company)
            throw new Error("invalid tenant or company.");
        var tenantId = req.user.tenant;
        var companyId = req.user.company;
        requsetMonitor.GetQueueSlaBreakDownRecords(tenantId, companyId, req.params.summaryDate, res);
    }
    catch (ex) {
        logger.error('[QueueSummaryHandler.GetQueueSlaBreakDownRecords] - [HTTP]  - Exception occurred -  Data - %s ', JSON.stringify(req.body), ex);
        var jsonString = messageFormatter.FormatMessage(ex, "EXCEPTION", false, undefined);
        logger.debug('[QueueSummaryHandler.GetQueueSlaBreakDownRecords] - Request response : %s ', jsonString);
        res.end(jsonString);
    }
    return next();
});


//--------------------------Resource Monitoring-------------------------------------
server.get('/DVP/API/:version/ARDS/MONITORING/resources',authorization({resource:"ardsresource", action:"read"}), function (req, res, next) {
    try {
            var company = req.user.company;
            var tenant = req.user.tenant;
            var data = req.params;
            var objkey = util.format('resource-getall:company_%s:tenant_%s', company, tenant);
            var logkey = util.format('[%s]::[%s]', uuid.v1(), objkey);

            infoLogger.ReqResLogger.log('info', '%s --------------------------------------------------', logkey);
            infoLogger.ReqResLogger.log('info', '%s Start- resource/getall #', logkey, {request: req.params});
            resourceMonitor.GetAllResources(logkey, company, tenant, function (err, result) {
                if (err) {
                    infoLogger.ReqResLogger.log('error', '%s End- resource/getall :: Error: %s #', logkey, err);
                    var jsonString = messageFormatter.FormatMessage(err, "ERROR", false, undefined);
                    res.writeHead(500, {'Content-Type': 'application/json; charset=utf-8'});
                    res.end(jsonString);
                }
                else {
                    infoLogger.ReqResLogger.log('info', '%s End- resource/getall :: Result: %s #', logkey, 'success');
                    var jsonString = messageFormatter.FormatMessage(err, "get resources success", true, result);
                    res.writeHead(200, {'Content-Type': 'application/json; charset=utf-8'});
                    res.end(jsonString);
                }
            });
    } catch (ex2) {
        var jsonString = messageFormatter.FormatMessage(ex2, "ERROR", false, undefined);
        res.writeHead(500, {'Content-Type': 'application/json; charset=utf-8'});
        res.end(jsonString);
    }
    return next();
});

server.get('/DVP/API/:version/ARDS/MONITORING/resources/:class/:type/:category',authorization({resource:"ardsresource", action:"read"}), function (req, res, next) {
    try {
            var company = req.user.company;
            var tenant = req.user.tenant;
            var data = req.params;
            var objkey = util.format('resource-filterByClassTypeCategory:company_%s:tenant_%s:class_%s:type_%s:category_%s', company, tenant, data["class"], data["type"], data["category"]);
            var logkey = util.format('[%s]::[%s]', uuid.v1(), objkey);

            infoLogger.ReqResLogger.log('info', '%s --------------------------------------------------', logkey);
            infoLogger.ReqResLogger.log('info', '%s Start- resource/getall #', logkey, {request: req.params});
            resourceMonitor.GetResourceFilterByClassTypeCategory(logkey, company, tenant, data["class"], data["type"], data["category"], function (err, result) {
                if (err) {
                    infoLogger.ReqResLogger.log('error', '%s End- resource/getall :: Error: %s #', logkey, err);
                    var jsonString = messageFormatter.FormatMessage(err, "ERROR", false, undefined);
                    res.writeHead(500, {'Content-Type': 'application/json; charset=utf-8'});
                    res.end(jsonString);
                }
                else {
                    infoLogger.ReqResLogger.log('info', '%s End- resource/getall :: Result: %s #', logkey, 'success');
                    var jsonString = messageFormatter.FormatMessage(err, "get resources success", true, result);
                    res.writeHead(200, {'Content-Type': 'application/json; charset=utf-8'});
                    res.end(jsonString);
                }
            });
    } catch (ex2) {
        var jsonString = messageFormatter.FormatMessage(ex2, "ERROR", false, undefined);
        res.writeHead(500, {'Content-Type': 'application/json; charset=utf-8'});
        res.end(jsonString);
    }
    return next();
});

server.post('/DVP/API/:version/ARDS/MONITORING/resources',authorization({resource:"ardsresource", action:"read"}), function (req, res, next) {
    try {
        var company = req.user.company;
        var tenant = req.user.tenant;
        var data = req.params;
        var objkey = util.format('resource-GetResourcesBySkills:company_%s:tenant_%s', company, tenant);
        var logkey = util.format('[%s]::[%s]', uuid.v1(), objkey);

        infoLogger.ReqResLogger.log('info', '%s --------------------------------------------------', logkey);
        infoLogger.ReqResLogger.log('info', '%s Start- resource/GetResourcesBySkills #', logkey, req.body);
        resourceMonitor.GetResourcesBySkills(logkey, company, tenant, req.body.skills, function (err, result) {
            if (err) {
                infoLogger.ReqResLogger.log('error', '%s End- resource/GetResourcesBySkills :: Error: %s #', logkey, err);
                var jsonString = messageFormatter.FormatMessage(err, "ERROR", false, undefined);
                res.writeHead(500, {'Content-Type': 'application/json; charset=utf-8'});
                res.end(jsonString);
            }
            else {
                infoLogger.ReqResLogger.log('info', '%s End- resource/GetResourcesBySkills :: Result: %s #', logkey, 'success');
                var jsonString = messageFormatter.FormatMessage(err, "get resources success", true, result);
                res.writeHead(200, {'Content-Type': 'application/json; charset=utf-8'});
                res.end(jsonString);
            }
        });
    } catch (ex2) {
        var jsonString = messageFormatter.FormatMessage(ex2, "ERROR", false, undefined);
        res.writeHead(500, {'Content-Type': 'application/json; charset=utf-8'});
        res.end(jsonString);
    }
    return next();
});

server.get('/DVP/API/:version/ARDS/MONITORING/acw/resource/:resourceId/:pageNo/:rowCount', authorization({resource:"ardsresource", action:"read"}), function(req, res, next) {
    var emptyArr = [];
    try
    {
        var startDate = req.query.startDate;
        var endDate = req.query.endDate;
        var skill = req.query.skill;
        var resourceId = req.params.resourceId;

        var pageNo =parseInt(req.params.pageNo);
        var rowCount = parseInt(req.params.rowCount);

        var companyId = req.user.company;
        var tenantId = req.user.tenant;

        if (!companyId || !tenantId)
        {
            throw new Error("Invalid company or tenant");
        }

        logger.debug('[DVP-ARDSMonitoring.GetResourceStatusDurationList] - HTTP Request Received - Params - startDate : %s, endDate : %s', startDate, endDate);


        resourceMonitor.GetResourceStatusDurationList(startDate, endDate, resourceId, companyId, tenantId, pageNo, rowCount, skill, function(err, resList)
        {
            var jsonString = messageFormatter.FormatMessage(null, "SUCCESS", true, resList);
            logger.debug('[DVP-ARDSMonitoring.GetResourceStatusDurationList] - API RESPONSE : %s', jsonString);
            res.end(jsonString);

        });

    }
    catch(ex)
    {
        var jsonString = messageFormatter.FormatMessage(ex, "ERROR", false, emptyArr);
        logger.debug('[DVP-ARDSMonitoring.GetResourceStatusDurationList] - API RESPONSE : %s', jsonString);
        res.end(jsonString);
    }

    return next();
});

server.get('/DVP/API/:version/ARDS/MONITORING/acw/summery/resource/:resourceId', authorization({
    resource:"ardsresource",
    action:"read"
}), function(req, res, next) {
    var emptyArr = [];
    try
    {
        var startDate = req.query.startDate;
        var endDate = req.query.endDate;
        var skill = req.query.skill;
        var resourceId = req.params.resourceId;

        var companyId = req.user.company;
        var tenantId = req.user.tenant;

        if (!companyId || !tenantId)
        {
            throw new Error("Invalid company or tenant");
        }

        logger.debug('[DVP-ARDSMonitoring.GetResourceStatusDurationSummery] - HTTP Request Received - Params - startDate : %s, endDate : %s', startDate, endDate);


        resourceMonitor.GetResourceStatusDurationSummery(startDate, endDate, resourceId, companyId, tenantId, skill, function(err, resList)
        {
            var jsonString = messageFormatter.FormatMessage(null, "SUCCESS", true, resList);
            logger.debug('[DVP-ARDSMonitoring.GetResourceStatusDurationSummery] - API RESPONSE : %s', jsonString);
            res.end(jsonString);

        });

    }
    catch(ex)
    {
        var jsonString = messageFormatter.FormatMessage(ex, "ERROR", false, emptyArr);
        logger.debug('[DVP-ARDSMonitoring.GetResourceStatusDurationSummery] - API RESPONSE : %s', jsonString);
        res.end(jsonString);
    }

    return next();
});

server.get('/DVP/API/:version/ARDS/MONITORING/resource/:resourceId/task/reject/:pageNo/:rowCount', authorization({resource:"ardsresource", action:"read"}), function(req, res, next) {
    var emptyArr = [];
    try
    {
        var startDate = req.query.startDate;
        var endDate = req.query.endDate;
        var resourceId = req.params.resourceId;

        var pageNo =parseInt(req.params.pageNo);
        var rowCount = parseInt(req.params.rowCount);

        var companyId = req.user.company;
        var tenantId = req.user.tenant;

        if (!companyId || !tenantId)
        {
            throw new Error("Invalid company or tenant");
        }

        logger.debug('[DVP-ARDSMonitoring.GetResourceRejectSummery] - HTTP Request Received - Params - startDate : %s, endDate : %s', startDate, endDate);


        resourceMonitor.GetResourceRejectSummery(startDate, endDate, resourceId, companyId, tenantId, pageNo, rowCount, function(err, resList)
        {
            var jsonString = messageFormatter.FormatMessage(null, "SUCCESS", true, resList);
            logger.debug('[DVP-ARDSMonitoring.GetResourceRejectSummery] - API RESPONSE : %s', jsonString);
            res.end(jsonString);

        });

    }
    catch(ex)
    {
        var jsonString = messageFormatter.FormatMessage(ex, "ERROR", false, emptyArr);
        logger.debug('[DVP-ARDSMonitoring.GetResourceRejectSummery] - API RESPONSE : %s', jsonString);
        res.end(jsonString);
    }

    return next();
});

server.get('/DVP/API/:version/ARDS/MONITORING/resource/:resourceId/task/rejectCount', authorization({resource:"ardsresource", action:"read"}), function(req, res, next) {
    var emptyArr = [];
    try
    {
        var startDate = req.query.startDate;
        var endDate = req.query.endDate;
        var resourceId = req.params.resourceId;

        var companyId = req.user.company;
        var tenantId = req.user.tenant;

        if (!companyId || !tenantId)
        {
            throw new Error("Invalid company or tenant");
        }

        logger.debug('[DVP-ARDSMonitoring.GetResourceRejectCount] - HTTP Request Received - Params - startDate : %s, endDate : %s', startDate, endDate);


        resourceMonitor.GetResourceRejectCount(startDate, endDate, resourceId, companyId, tenantId, function(err, resList)
        {
            var jsonString = messageFormatter.FormatMessage(null, "SUCCESS", true, resList);
            logger.debug('[DVP-ARDSMonitoring.GetResourceRejectCount] - API RESPONSE : %s', jsonString);
            res.end(jsonString);

        });

    }
    catch(ex)
    {
        var jsonString = messageFormatter.FormatMessage(ex, "ERROR", false, emptyArr);
        logger.debug('[DVP-ARDSMonitoring.GetResourceRejectCount] - API RESPONSE : %s', jsonString);
        res.end(jsonString);
    }

    return next();
});


server.get('/DVP/API/:version/ARDS/MONITORING/resource/:resourceId/task/reject/prepareForDownload', authorization({resource:"ardsresource", action:"read"}), function(req, res, next) {
    var emptyArr = [];
    try
    {
        var startDate = req.query.startDate;
        var endDate = req.query.endDate;
        var resourceId = req.params.resourceId;

        var companyId = parseInt(req.user.company);
        var tenantId = parseInt(req.user.tenant);

        if (!companyId || !tenantId)
        {
            throw new Error("Invalid company or tenant");
        }

        logger.debug('[DVP-ARDSMonitoring.GetResourceRejectCount] - HTTP Request Received - Params - startDate : %s, endDate : %s', startDate, endDate);


        resourceMonitor.PrepareForDownloadResourceRejectSummery(startDate, endDate, resourceId, companyId, tenantId, res);

    }
    catch(ex)
    {
        var jsonString = messageFormatter.FormatMessage(ex, "ERROR", false, emptyArr);
        logger.debug('[DVP-ARDSMonitoring.GetResourceRejectCount] - API RESPONSE : %s', jsonString);
        res.end(jsonString);
    }

    return next();
});



//---------------------------Call Center Monitoring-----------------------------------
server.get('/DVP/API/:version/ARDS/MONITORING/callCenter/from/:summaryFromDate/to/:summaryToDate',authorization({resource:"queue", action:"read"}), function (req, res, next) {

    var jsonString;
    try {
        logger.info('[callCenterMonitor.callCenterPerformance] - [HTTP]  - Request received -  Data - %s ', JSON.stringify(req.params));

        if (!req.user ||!req.user.tenant || !req.user.company)
            throw new Error("invalid tenant or company.");
        var tenantId = req.user.tenant.toString();
        var companyId = req.user.company.toString();

        if(req.query && req.query.reqType === 'download'){
            callCenterMonitor.PrepareForDownloadCallCenterPerformance(tenantId, companyId, req.params.summaryFromDate, req.params.summaryToDate, res);
        }else {
            callCenterMonitor.GetCallCenterPerformance(tenantId, companyId, req.params.summaryFromDate, req.params.summaryToDate, function (err, result) {
                if (err) {
                    jsonString = messageFormatter.FormatMessage(err, "Error", false, undefined);
                    res.end(jsonString);
                } else {
                    jsonString = messageFormatter.FormatMessage(undefined, "Get Call Center Performance Success", true, result);
                    res.end(jsonString);
                }
            });
        }
    }
    catch (ex) {
        logger.error('[callCenterMonitor.callCenterPerformance] - [HTTP]  - Exception occurred -  Data - %s ', JSON.stringify(req.body), ex);
        jsonString = messageFormatter.FormatMessage(ex, "Error", false, undefined);
        logger.debug('[callCenterMonitor.callCenterPerformance] - Request response : %s ', jsonString);
        res.end(jsonString);
    }
    return next();
});


server.get('/DVP/API/:version/ARDS/MONITORING/resource/:resourceId/status/publish', authorization({resource:"ardsresource", action:"write"}), resourceMonitor.SetAndPublishResourceStatus);



server.listen(hostPort, function () {
    console.log('%s listening at %s', server.name, server.url);
});