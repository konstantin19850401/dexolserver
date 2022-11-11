"use strict"
const STATUSES = {ACTIVE: 1, BLOCKED: 2};
class User {
	#username;#group;#status;#uid;#sessionStatus;
	#data = {};#toolbox;
	#subscription;#lastSubscription;
	#runningApps = [];#packages = [];#timer;
	constructor(row, toolbox) {
		this.#username = row?.username;
		this.#group = row?.group;
		this.#status = row?.status;
		this.#toolbox = toolbox;
		this.#uid = this.#toolbox.GenerateUniqueHash();
		row?.data && row.data != "" && this.#ParseData(row.data);
	}
	get Status() { return this.#status; }
	get Username() { return this.#username; }
	get FSName() { return [this.#data?.fname, this.#data?.sname].filter(Boolean).join(" "); }
	get FSLName() { return [this.#data?.lname, this.#data?.fname, this.#data?.sname].filter(Boolean).join(" "); }
	get Uid() { return this.#uid; }
	get IfOpenConnection() { return this.#subscription && true || false; }
	get Userpic() { return this.#data?.userpic; }
	get AppsList() { return this.#data?.apps.map(item=> { return {name: item.name, title: item.title} }); }
	get LastSubscription() { return this.#lastSubscription; }
	set Connection(res) {
		this.#subscription = res;
		this.#lastSubscription = new Date().getTime();
	}

	#ParseData(data) {
		try {
			this.#data = JSON.parse(data);
		} catch(e) { console.log("Ошибка в процессе парсинга данных пользователя"); }
	}
	#Tick() {
		// console.log("таймер user => ", this.#uid);
		if (this.#packages.length > 0 && this.IfOpenConnection) {
			this.CloseConnection(this.#packages.shift(1));
			this.#StopTimer();
		}
	}
	#StopTimer() {
		clearTimeout(this.#timer);
		this.#timer = null;
	}


	RunApp(app) {
		if (!this.#data?.apps) return false;
		if (!this.#data?.apps.find(item=> item.name == app)) return false;
		if (this.#runningApps.indexOf(app) != -1) return false;
		this.#runningApps.push(app);
		return true;
	}
	Lock() { this.#sessionStatus = STATUSES.BLOCKED; }
	UnLock() { this.#sessionStatus = STATUSES.ACTIVE; }
	CloseConnection(packet) {
		if (packet) {
			if (typeof packet !== "string") packet = JSON.stringify(packet);
			if (this.IfOpenConnection) {
				this.#subscription.end(packet);
				this.#subscription = null;
			} else {
				// console.log("Нет линка. Подождем подписку");
				this.#packages.push(packet);
				if (!this.#timer) this.#timer = setInterval(()=> {this.#Tick()}, 500);
			}
		}
	}
}
module.exports = User;