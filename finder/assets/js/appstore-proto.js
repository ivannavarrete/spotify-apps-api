// package spotify.appstore.proto

var SPOTIFY_APPSTORE_PROTO_SCHEMA = [
	{
		name: "RequestHeader",
		fields: [
			{id: 1, type: "string", name: "market"},
			{id: 2, type: "int32", name: "platform"}, // enum Platform
		]
	},
	{
		name: "AppItem",
		fields: [
			{id: 1, type: "string", name: "app_name"},
			{id: 2, type: "int32", name: "requirement"}, // enum Requirement
			{id: 3, type: "int32", name: "status"},
			{id: 4, type: "string", name: "manifest"},
			{id: 5, type: "string", name: "checksum"},
			{id: 6, type: "string", name: "bundle_uri" },
			{id: 7, type: "string", name: "small_icon_uri" },
			{id: 8, type: "string", name: "large_icon_uri" },
		]
	},
	{
		name: "AppList",
		fields: [
			{id: 1, type: "*AppItem", name: "items"},
		]
	},
];

sp.core.registerSchema(SPOTIFY_APPSTORE_PROTO_SCHEMA);

// enum Platform
var WIN32_X86 = 0;
var OSX_X86 = 1;
var LINUX_X86 = 2;
var IPHONE_ARM = 3;
var SYMBIANS60_ARM = 4;
var OSX_POWERPC = 5;
var ANDROID_ARM = 6;
var WINCE_ARM = 7;
var LINUX_X86_64 = 8;
var OSX_X86_64 = 9;
var PALM_ARM = 10;
var LINUX_SH = 11;
var FREEBSD_X86 = 12;
var FREEBSD_X86_64 = 13;
var BLACKBERRY_ARM = 14;
var SONOS_UNKNOWN = 15;
var LINUX_MIPS = 16;
var LINUX_ARM = 17;
var LOGITECH_ARM = 18;
var LINUX_BLACKFIN = 19;
var ONKYO_ARM = 21;
var QNXNTO_ARM = 22;
var BADPLATFORM = 255;

// enum Requirement
var REQUIRED_INSTALL = 1;
var LAZYLOAD = 2;
var OPTIONAL_INSTALL = 3;