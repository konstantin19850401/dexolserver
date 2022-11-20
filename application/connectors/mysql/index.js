'use strict'
// МОДУЛИ
// let mysql = require("mysql");
let mysql = require("mysql2");
class Mysql {
    #bases = [];#pool = [];
    #name = "mysql";
    constructor() {}
    get Bases() {return this.#bases; }
    get Name() { return this.#name; }
    #CreatePool( name ) {
        let pool = mysql.createPool( this.#bases.find(item => item.Name == name)?.Config );
        this.#pool.push({name: name, pool: pool})
        return pool;
    }
    #Connect( name ) { return this.#bases.find(item => item.Name == name) && ( this.#pool.find(item => item.name == name)?.pool || this.#CreatePool( name ) ) || null; }
    #PrintError(name, string, err) { console.log(`Ошибка соединения с базой данных. Имя соединения=> ${name}. Запрос ${string}. Описание ошибки=> ${err}`); }

    AddBase(data) { !this.#bases.find(item => item.Name == data.name) && this.#bases.push(new Base(data)); }
    async Request( name, string ) {
        return new Promise((resolve, reject) => {
            this.#Connect(name)?.getConnection((err, connection) => {
                if (err) {
                    this.#PrintError(name, string, err);
                    reject( null );
                } else {
                    connection.query(string, (err, result, fields) => {
                        if (err) this.#PrintError(name, string, err);
                        connection.release();
                        resolve( result );
                    })
                }
            })
        })
    }
}

class Base {
    #name;#connectionLimit;#host;#user;#password;#database;
    constructor(conf) {
        this.#name = conf.name;
        this.#connectionLimit = conf.connectionLimit || 60;
        this.#host = conf.host;
        this.#user = conf.user;
        this.#password = conf.password;
        this.#database = conf.database;
    }
    get Name() { return this.#name; }
    get Config() { return {host: this.#host, user: this.#user, password: this.#password, database: this.#database, connectionLimit: this.#connectionLimit} }
}

module.exports = Mysql;