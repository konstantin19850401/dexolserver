"use strict"
class HttpStatuses {
	constructor() {}
	static get PROCESSING() { return 102; }
	static get OK() { return 200; }
	static get CREATED() { return 201; }
	static get ACCEPTED() { return 202; }
	static get BAD_REQUEST() { return 400; }
	static get UNAUTHORIZED() { return 401; }
	static get FORBIDDEN() { return 403; }
	static get METHOD_NOT_ALLOWED() { return 405; }
	static get CONFLICT() { return 409; }
	static get LOCKED() { return 423; }
	static get CLIENT_CLOSED_REQUEST() { return 499; }
	static get INTERNAL_SERVER_ERROR() { return 500; }
}
module.exports = HttpStatuses;