﻿module.exports = {
	"Redis":{
		"redisip":"SYS_REDIS_HOST",
		"redisport":"SYS_REDIS_PORT",
		"password":"SYS_REDIS_PASSWORD",
		"redisdb":"SYS_REDIS_DB_ARDS"
	},
	"Services" : {
		"accessToken": "HOST_TOKEN",
		"routingServiceHost": "SYS_ARDSLITEROUTINGENGINE_HOST",
		"routingServicePort": "SYS_ARDSLITEROUTINGENGINE_PORT",
		"routingServiceVersion": "SYS_ARDSLITEROUTINGENGINE_VERSION"
	},
	"Host": {
		"Port": "HOST_ARDSMONITOR_PORT",
		"Version": "HOST_VERSION"
	},
	"DB": {
		"Type": "SYS_DATABASE_TYPE",
		"User": "SYS_DATABASE_POSTGRES_USER",
		"Password": "SYS_DATABASE_POSTGRES_PASSWORD",
		"Port": "SYS_SQL_PORT",
		"Host": "SYS_DATABASE_HOST",
		"Database": "SYS_DATABASE_POSTGRES_USER"
	},
	"Security":
	{
		"ip": "SYS_REDIS_HOST",
		"port": "SYS_REDIS_PORT",
		"user": "SYS_REDIS_USER",
		"password": "SYS_REDIS_PASSWORD"
	}
};
