"use strict"
const RulesMega = require("./RulesMega");
const RulesMts = require("./RulesMts");
const RulesYota = require("./RulesYota");
const RulesBeeline = require("./RulesBeeline");

class Converter {
	#toolbox;#connector;#base;#operator;#rules;
	constructor(toolbox, connector, base) {
		this.#toolbox = toolbox;
		this.#connector = connector;
		this.#base = base;
		this.#operator = base.Operator;
		let rules = RulesMega;
		if (this.#operator == "MTS") rules = RulesMts;
		else if (this.#operator == "BEELINE") rules = RulesBeeline;
		else if (this.#operator == "YOTA") rules = RulesYota;
		this.#rules = rules;
		// if (this.#base.BaseName == "dex_beeline_kcr") {
			this.#Init2();
		// }
		// this.#Init();
		// console.log("this.#base.Name=> ", this.#base.Name);
		// console.log("this.#base.Name=> ", this.#base.BaseName);
		// console.log("this.#operator=> ", this.#operator);
	}
	async #Init() {
		await this.#connector.Request("dexol", `
            CREATE TABLE IF NOT EXISTS ${this.#base.BaseName} (
                id INT(15) AUTO_INCREMENT NOT NULL,
                userId VARCHAR(32) NOT NULL,
                jtype TINYINT(1) NOT NULL,
                store INT(10) NOT NULL,
                status INT(2) NOT NULL,
                signature VARCHAR(25) NOT NULL,
                jdocdate VARCHAR(17) NOT NULL,
                data TEXT NOT NULL,
                type TINYINT(1) NOT NULL,
                del INT(2) NOT NULL DEFAULT 0,
                primary key (id)
            ) ENGINE = InnoDB
            PARTITION BY HASH(id) (
            	PARTITION p0 ENGINE=InnoDB,
				PARTITION p1 ENGINE=InnoDB,
				PARTITION p2 ENGINE=InnoDB,
				PARTITION p3 ENGINE=InnoDB,
				PARTITION p4 ENGINE=InnoDB,
				PARTITION p5 ENGINE=InnoDB,
				PARTITION p6 ENGINE=InnoDB,
				PARTITION p7 ENGINE=InnoDB,
				PARTITION p8 ENGINE=InnoDB,
				PARTITION p9 ENGINE=InnoDB
            )
        `);

		let jtypes = [{id: 2, name: "archive"}, {id: 1, name: "journal"}]
        // let jtypes = [{id: 2, name: "archive"}]
        // let jtypes = [{id: 1, name: "journal"}];
        for (let jtype of jtypes) {
            let cc = 0;
            let cnt = 0;let arr = [];
            // console.log("запрос типа ", jtype.name);
            console.log("получение данных и вставка ", jtype.name);
            let rows = await this.#connector.Request(this.#base.Name, `SELECT * FROM ${jtype.name}`);
             console.log("Данные получены. Количество строк => ", rows.length);
            let date = this.#toolbox.Moment();
            let inserts = [];
            for (let row of rows) {
                let docType = 1;// 1 - вручную. 2 - автоматически автодоком, 3 - автоматически из выгрузки из удаленки оператора. Данные не полные. 4 - на основании другого документа
                // console.log(row.data);
                let temp = await this.#toolbox.XmlToString(row.data);
                let data = {document: {}};
                if (temp?.Document) {
                    data.document.DocCity = Array.isArray(temp.Document?.DocCity) ? temp.Document?.DocCity[0] : "";
                    data.document.DocNum = Array.isArray(temp.Document?.DocNum) ? temp.Document?.DocNum[0] : "";
                    data.document.DocDateJournal = Array.isArray(temp.Document?.DocDateJournal) ? temp.Document?.DocDateJournal[0] : "";
                    data.document.DocDate = Array.isArray(temp?.Document?.DocDate) ? temp?.Document?.DocDate[0] : "";
                    data.document.CodeWord = Array.isArray(temp.Document?.CodeWord) ? temp.Document?.CodeWord[0] : "";
                    data.document.MSISDN = Array.isArray(temp.Document?.MSISDN) ? temp.Document?.MSISDN[0] : "";
                    data.document.ICC = Array.isArray(temp.Document?.ICC) ? temp.Document?.ICC[0] : "";
                    data.document.ICCCTL = Array.isArray(temp.Document?.ICCCTL) ? temp.Document?.ICCCTL[0] : "";
                    data.document.FirstName = Array.isArray(temp.Document?.FirstName) ? temp.Document?.FirstName[0] : "";
                    data.document.SecondName = Array.isArray(temp.Document?.SecondName) ? temp.Document?.SecondName[0] : "";
                    data.document.LastName = Array.isArray(temp.Document?.LastName) ? temp.Document?.LastName[0] : "";
                    data.document.Birth = Array.isArray(temp.Document?.Birth) ? temp.Document?.Birth[0] : "";

                    data.document.FizDocNumber = Array.isArray(temp.Document?.FizDocNumber) ? temp.Document?.FizDocNumber[0] : "";
                    data.document.FizDocSeries = Array.isArray(temp.Document?.FizDocSeries) ? temp.Document?.FizDocSeries[0] : "";
                    data.document.FizDocOrgCode = Array.isArray(temp.Document?.FizDocOrgCode) ? temp.Document?.FizDocOrgCode[0] : "";
                    data.document.FizDocOrg = Array.isArray(temp.Document?.FizDocOrg) ? temp.Document?.FizDocOrg[0] : "";
                    data.document.FizDocDate = Array.isArray(temp.Document?.FizDocDate) ? temp.Document?.FizDocDate[0] : "";
                    data.document.FizBirthPlace = Array.isArray(temp.Document?.FizBirthPlace) ? temp.Document?.FizBirthPlace[0] : "";

                    data.document.AddrZip = Array.isArray(temp.Document?.AddrZip) ? temp.Document?.AddrZip[0] : "";
                    data.document.AddrStreet = Array.isArray(temp.Document?.AddrStreet) ? temp.Document?.AddrStreet[0] : "";
                    data.document.AddrHouse = Array.isArray(temp.Document?.AddrHouse) ? temp.Document?.AddrHouse[0] : "";
                    data.document.AddrBuilding = Array.isArray(temp.Document?.AddrBuilding) ? temp.Document?.AddrBuilding[0] : "";
                    data.document.AddrApartment = Array.isArray(temp.Document?.AddrApartment) ? temp.Document?.AddrApartment[0] : "";
                    if (data.document.AddrApartment == ".") data.document.AddrApartment = "";
                    data.document.AddrPhone = Array.isArray(temp.Document?.AddrPhone) ? temp.Document?.AddrPhone[0] : "";
                    data.document.AddrRegion = Array.isArray(temp.Document?.AddrRegion) ? temp.Document?.AddrRegion[0] : "";

                    data.document.ContactEmail = Array.isArray(temp.Document?.ContactEmail) ? temp.Document?.ContactEmail[0] : "";
                    data.document.FizInn = Array.isArray(temp.Document?.FizInn) ? temp.Document?.FizInn[0] : "";

                    data.document.DeliveryStreet = Array.isArray(temp.Document?.DeliveryStreet) ? temp.Document?.DeliveryStreet[0] : "";
                    data.document.DeliveryHouse = Array.isArray(temp.Document?.DeliveryHouse) ? temp.Document?.DeliveryHouse[0] : "";
                    data.document.DeliveryBuilding = Array.isArray(temp.Document?.DeliveryBuilding) ? temp.Document?.DeliveryBuilding[0] : "";
                    data.document.DeliveryApartment = Array.isArray(temp.Document?.DeliveryApartment) ? temp.Document?.DeliveryApartment[0] : "";
                    if (data.document.DeliveryApartment == ".") data.document.DeliveryApartment = "";
                    data.document.DeliveryZip = Array.isArray(temp.Document?.DeliveryZip) ? temp.Document?.DeliveryZip[0] : "";
                    data.document.DeliveryRegion = Array.isArray(temp.Document?.DeliveryRegion) ? temp.Document?.DeliveryRegion[0] : "";

                    if (this.#operator == "MTS") {
                    	data.document.AssignedDPCode = Array.isArray(temp.Document?.AssignedDPCode) ? temp.Document?.AssignedDPCode[0] : "";
                    	data.document.DPCodeKind = Array.isArray(temp.Document?.DPCodeKind) ? temp.Document?.DPCodeKind[0] : "";
                    }
                 

                    //категория оплаты
                    if (temp.Document?.DocCategory) {
                        if (this.#operator == "MEGAFON") data.document.DocCategory = RulesMega.DocCategory(parseInt(temp.Document?.DocCategory[0]));
                    }

                    // // пол
                    if (temp.Document?.Sex) {
                        data.document.Sex = this.#rules.Sex(parseInt(temp.Document?.Sex[0]));
                    }

                    // // профиль отправки
                    // if (temp.Document?.ProfileCode) {
                    //     if (this.#operator == "MEGAFON") data.document.ProfileCode = RulesMega.ProfileCode(temp.Document?.ProfileCode[0]);
                    //     if (data.document.ProfileCode == "" && Array.isArray(temp.Document?.ProfileCode) && temp.Document?.ProfileCode[0] != "") {
                    //         if (arr.indexOf(temp.Document.ProfileCode[0]) == -1) {
                    //             arr.push(temp.Document.ProfileCode[0]);
                    //             console.log(`"${temp.Document.ProfileCode[0].toLowerCase()}",`);
                    //             if (cc == 10) break;
                    //             else cc++;
                    //         }
                    //     }
                    // }

                    // // страна
                	if (temp.Document?.AddrCountry) {
                        data.document.AddrCountry = this.#rules.GetCountry(temp.Document?.AddrCountry[0]);
                        if (data.document.AddrCountry == "" && Array.isArray(temp.Document?.AddrCountry) && temp.Document?.AddrCountry[0] != "") {
                        	 if (arr.indexOf(temp.Document.AddrCountry[0]) == -1) {
                                arr.push(temp.Document.AddrCountry[0]);
                                console.log(`"${temp.Document.AddrCountry[0].toLowerCase()}",`);
                                console.log(`для >${temp.Document?.AddrCountry[0]}< нет значения страны. id = `, row.id);
                                if (cc > 70) break;
                                else cc++;
                            }

                            
                            // if (cc == 5) break;
                            // else cc++;
                        }
                    } else {
                    	data.document.AddrCountry = "";
                    }
                
                    // // страна доставки
                    // if (temp.Document?.DeliveryCountry) {
                    //     if (this.#operator == "MEGAFON") {
                    //         data.document.DeliveryCountry = RulesMega.GetCountry(temp.Document?.DeliveryCountry[0]);
                    //         if (data.document.DeliveryCountry == "" && Array.isArray(temp.Document?.DeliveryCountry) && temp.Document?.DeliveryCountry[0] != "") {
                    //             console.log(`для >${temp.Document?.DeliveryCountry[0]}< нет значения страны доставки. id = `, row.id);
                    //             if (cc == 5) break;
                    //             else cc++;
                    //         }
                    //     }
                    // }

                    // // тип абонента(резидент/нерезидент)
                    // if (temp.Document?.DocClientType) {
                        if (this.#operator == "MEGAFON") {
                            data.document.DocClientType = this.#rules.DocClientType(temp.Document?.DocClientType[0]);
                        } else if (this.#operator == "MTS") {
                        	try {
                        		data.document.DocClientType = temp.Document?.DocCategory ? this.#rules.DocClientType(temp.Document?.DocCategory[0]) : "";
                        	} catch(e) {
                        		console.log(row.id);
                        		console.log(e);
                        	}

                        }

                    // }

                    // регион
                    if (temp.Document?.AddrState) {
                        data.document.AddrState = this.#rules.AddrState(temp.Document?.AddrState[0]);
                        if (data.document.AddrState == "" && Array.isArray(temp.Document?.AddrState) && temp.Document?.AddrState[0] != "") {
                            if (arr.indexOf(temp.Document.AddrState[0]) == -1) {
                                arr.push(temp.Document.AddrState[0]);
                                console.log(`"${temp.Document.AddrState[0].toLowerCase()}",`);
                                // if (cc > 70) break;
                                // else cc++;
                            }

                        }
                    }
                    // регион доставки
                    // if (temp.Document?.DeliveryState) {
                    //     if (this.#operator == "MEGAFON") {
                    //         data.document.DeliveryState = RulesMega.AddrState(temp.Document?.DeliveryState[0]);
                    //         if (data.document.DeliveryState == "" && Array.isArray(temp.Document?.DeliveryState) && temp.Document?.DeliveryState[0] != "") {
                    //             if (arr.indexOf(temp.Document.DeliveryState[0]) == -1) {
                    //                 arr.push(temp.Document.DeliveryState[0]);
                    //                 console.log(`"${temp.Document.DeliveryState[0].toLowerCase()}",`);
                    //                 if (cc == 40) break;
                    //                 else cc++;
                    //             }

                    //         }
                    //     }
                    // }

                    // фирменный салон связи или нет
                    if (Array.isArray(temp.Document?.fs)) {
                        data.document.Fs = this.#rules.Fs(temp.Document.fs);
                    } else data.document.Fs = 2;


                    // //тип документа
                    if (this.#operator == "MEGAFON" || this.#operator == "YOTA") {
                    	if (temp.Document?.gf && Array.isArray(temp.Document?.gf) && temp.Document?.gf[0] == "True") {
	                        try {
	                            data.document.FizDocType = this.#rules.FizDocTypeNew(parseInt(temp.Document?.FizDocType[0]));
	                        } catch(e) {
	                            docType = 3;
	                        }
	                    } else {
	                        try {
	                            if (this.#toolbox.IsNumber(temp.Document?.FizDocType[0])) {
	                                data.document.FizDocType = this.#rules.FizDocTypeOld(parseInt(temp.Document?.FizDocType[0]));
	                            } else {
	                                data.document.FizDocType = this.#rules.FizDocTypeOldString(temp.Document?.FizDocType[0]);

	                                if (data.document.FizDocType == 14) {
		                    			data.document.FizDocOtherType = temp.Document?.FizDocOtherDocTypes ? this.#rules.FizDocTypeOldString(temp.Document?.FizDocOtherDocTypes[0]) : "";
		                    			if (data.document.FizDocOtherType == "" && arr.indexOf(data.document.FizDocOtherType) == -1) {
				                    		arr.push(temp.Document?.FizDocOtherDocTypes[0]);
				                    		console.log("Тип документа отсутствует для id = ", row.id, " ==> ", temp.Document?.FizDocOtherDocTypes[0]);
				                    		if (cc > 70) break;
			                                else cc++;
			                    		}
		                    		}
	                            }
	                        } catch(e) {
	                            docType = 3;
	                        }
	                    }
                    } else if (this.#operator == "MTS" || this.#operator == "BEELINE") {
                    	if (temp.Document?.FizDocType && Array.isArray(temp.Document?.FizDocType)) {
                    		if (temp.Document?.FizDocType[0]?._) {
	                    		data.document.FizDocType = this.#rules.FizDocType(parseInt(temp.Document?.FizDocType[0]?._));
	                    	} else {
	                    		data.document.FizDocType = this.#rules.FizDocType(parseInt(temp.Document?.FizDocType[0]));
	                    	}
                    	} else data.document.FizDocType = "";

                    } 


                    if (data.document.FizDocType == "" && temp.Document?.FizDocType) {
                    	if (this.#operator == "YOTA") {
                    		if (data.document.FizDocType == 14) {
                    			console.log("+++");
                    			data.document.FizDocOtherType = temp.Document?.FizDocOtherDocTypes ? this.#rules.FizDocTypeOldString(temp.Document?.FizDocOtherDocTypes[0]) : "";
                    			if (arr.indexOf(temp.Document?.FizDocOtherDocTypes[0]) == -1) {
		                    		arr.push(temp.Document?.FizDocOtherDocTypes[0]);
		                    		console.log("Тип документа отсутствует для id = ", row.id, " ==> ", temp.Document?.FizDocOtherDocTypes[0]);
		                    		if (cc > 70) break;
	                                else cc++;
	                    		}
                    		} else {
                    			if (arr.indexOf(temp.Document?.FizDocType[0]) == -1) {
		                    		arr.push(temp.Document?.FizDocType[0]);
		                    		console.log("Тип документа отсутствует для id = ", row.id, " ==> ", temp.Document?.FizDocType[0]);
		                    		if (cc > 70) break;
	                                else cc++;
	                    		}
                    		}

                    		
                    	} else if (typeof temp.Document?.FizDocType[0]?._ === "undefined") {
                    		data.document.FizDocType = "";
                    	} else if (arr.indexOf(parseInt(temp.Document?.FizDocType[0]?._)) == -1) {
                    		arr.push(parseInt(temp.Document?.FizDocType[0]?._));
                    		console.log("Тип документа отсутствует для id = ", row.id, " ==> ", temp.Document?.FizDocType[0]?._);
                    		cc++
                    	}
                    } 

					
					if (temp.Document?.FizDocCitizen && Array.isArray(temp.Document.FizDocCitizen)) {
						if (this.#operator == "MTS") {
							data.document.Citizenship = temp.Document?.FizDocCitizen[0]?.$?.tag ? this.#rules.GetCountry(parseInt(temp.Document?.FizDocCitizen[0]?.$?.tag)) : "";
							if (data.document.Citizenship == "") {
								if (temp.Document?.FizDocCitizen[0]?.$?.tag == "Российская Федерация") {
									data.document.Citizenship = 235
								} else if (temp.Document?.FizDocCitizen[0] == "") {
									data.document.Citizenship = "";
								} else if (arr.indexOf(parseInt(temp.Document?.FizDocCitizen[0]?.$?.tag)) == -1) {
									console.log("---temp.Document?.FizDocCitizen=> ", temp.Document?.FizDocCitizen);
	                                arr.push(parseInt(temp.Document?.FizDocCitizen[0]?.$?.tag));
	                                console.log(`---"${temp.Document?.FizDocCitizen[0]?.$?.tag}", `, temp.Document?.FizDocCitizen[0]?._, " id=>", row.id);
	                                // if (cc == 10) break;
	                                cc++;
	                            }
							}
						} else if (this.#operator == "YOTA") {
							data.document.Citizenship = this.#rules.GetCountry(parseInt(temp.Document?.FizDocCitizen[0]));
							if (data.document.Citizenship == "") {
								if (Array.isArray(temp.Document?.FizDocCitizen) && temp.Document?.FizDocCitizen[0] != "") {
		                        	if (arr.indexOf(temp.Document.FizDocCitizen[0]) == -1) {
		                                arr.push(temp.Document.FizDocCitizen[0]);
		                                console.log(`+++"${temp.Document.FizDocCitizen[0].toLowerCase()}",`);
		                                console.log("+++temp.Document?.FizDocCitizen=> ", temp.Document?.FizDocCitizen);
		                                if (cc > 70) break;
		                                else cc++;
		                            }

		                            
		                            // if (cc == 5) break;
		                            // else cc++;
		                        }
	                    	}


							// if (data.document.Citizenship == "") {
							// 	if (arr.indexOf(parseInt(temp.Document?.FizDocCitizen[0])) == -1) {
							// 		console.log("temp.Document?.FizDocCitizen=> ", temp.Document?.FizDocCitizen);
	                        //         arr.push(parseInt(temp.Document?.FizDocCitizen[0]));
	                        //         console.log(`"${temp.Document?.FizDocCitizen[0]}", `, temp.Document?.FizDocCitizen[0], " id=>", row.id);
	                        //         // if (cc == 10) break;
	                        //         cc++;
	                        //     }
							// }
						}
					}                    


                    for (let key in data.document) data.document[key] = this.#toolbox.HtmlSpecialChars(data.document[key]);

                    // // console.log("data=> ", data.document);

                    // // если docType == 1, надо бы тогда с журналом разобраться
                    if (docType == 1) {
                        let logs = await this.#toolbox.XmlToString(row.journal);
                        if (logs && logs?.journal?.record && logs?.journal?.record[0]) {
                            if (logs.journal.record[0]?.text && logs.journal.record[0]?.text == "Документ сформирован функцией формирования группы документов") {
                                docType = 2;
                            } else if (logs.journal.record[0]?.text && logs.journal.record[0]?.text == "Документ на основе другого документа добавлен в журнал") {
                                docType = 4;
                            }
                        } else if (logs && logs?.root?.record && logs?.root?.record[0]) {
                        	if (logs?.root?.record[0]?.text && logs?.root?.record[0]?.text == "Документ сформирован функцией формирования группы документов") {
                                docType = 2;
                            } else if (logs?.root?.record[0]?.text && logs?.root?.record[0]?.text == "Документ на основе другого документа добавлен в журнал") {
                                docType = 4;
                            }
                        } else if (logs && logs?.root?.journal) {
                        	if (logs?.root?.journal?.record && logs?.root?.journal?.record[0]?.text == "Документ сформирован функцией формирования группы документов") {
                                docType = 2;
                            } else if (logs?.root?.journal?.record && logs?.root?.journal?.record[0]?.text == "Документ на основе другого документа добавлен в журнал") {
                                docType = 4;
                            }
                        } else if (logs && logs?.journal == "") {
                        	logs = {};
                        	docType = 2;
                        } else { 
                        	if (!logs) {
                        		logs = {};
                        		docType = 2;
                        	} else {
                        		console.log(logs);
                        		console.log("для записи ", row.id, " журнал вполне возможно с ошибкой");
                        	}
                        }
                    }

                    let userId;
                    if (row.userid == "dex") userId = "";
                    else {
                        userId = this.#rules.UserId(row.userid);
                        if (userId == "") {
                        	console.log(`нет userid для >${row.userid}< row.id=> `, row.id);
                        	cc++;
                        }
                    }
                    // if (cc > 70) break;

                    let time = date(row.signature, "YYYYMMDDhhmmssSSS").format("YYYY-MM-DD hh:mm:ss.SSS");
                    // await this.#connector.Request("dexol", `
                    //     INSERT INTO dex_${this.#name}
                    //     SET userId = '${userId}', jtype = '${jtype.id}', store = '${row.unitid}', status = '${row.status}', signature = '${row.signature}', jdocdate = '${row.jdocdate}', data = '${JSON.stringify(data)}', date = '${time}', type = '${docType}'
                    // `);
                    // break;
                    // this.#journal.set(row.id, data);
                    //
                    //

                    let value = `('${userId}','${jtype.id}','${row.unitid}','${row.status}','${row.signature}','${row.jdocdate}','${JSON.stringify(data)}','${docType}')`;
                    inserts.push(value);


                    if (inserts.length == 100 || cnt == rows.length - 1) {
                        if (inserts.length > 0) {
                            let result = await this.#connector.Request("dexol", `
                                INSERT INTO ${this.#base.BaseName} (userId, jtype, store, status, signature, jdocdate, data, type)
                                VALUES ${inserts.join(",")}
                            `);
                            // console.log(result);
                            if (inserts.length != result.affectedRows) console.log("не соответствует");
                            inserts = [];
                        }
                    }
                } else console.log("нет значения");
                // break;


                cnt++;
            }
            console.log("вставка окончена. Обработано ", cnt, " записей");
        }
	}

	async #Init2() {
		await this.#connector.Request("dexol", `
            CREATE TABLE IF NOT EXISTS ${this.#base.BaseName} (
                id INT(15) AUTO_INCREMENT NOT NULL,
                userId VARCHAR(32) NOT NULL,
                jtype TINYINT(1) NOT NULL,
                store INT(10) NOT NULL,
                status INT(2) NOT NULL,
                signature VARCHAR(25) NOT NULL,
                jdocdate VARCHAR(17) NOT NULL,
                data TEXT NOT NULL,
                type TINYINT(1) NOT NULL,
                del INT(2) NOT NULL DEFAULT 0,
                primary key (id)
            ) ENGINE = InnoDB
            PARTITION BY HASH(id) (
            	PARTITION p0 ENGINE=InnoDB,
				PARTITION p1 ENGINE=InnoDB,
				PARTITION p2 ENGINE=InnoDB,
				PARTITION p3 ENGINE=InnoDB,
				PARTITION p4 ENGINE=InnoDB,
				PARTITION p5 ENGINE=InnoDB,
				PARTITION p6 ENGINE=InnoDB,
				PARTITION p7 ENGINE=InnoDB,
				PARTITION p8 ENGINE=InnoDB,
				PARTITION p9 ENGINE=InnoDB
            )
        `);
        let jtypes = [{id: 1, name: "journal"},{id: 2, name: "archive"}];
        let date = this.#toolbox.Moment();
        for (let jtype of jtypes) {
        	let arr = [];let inserts = [];let cnt = 0;
        	let rows = await this.#connector.Request(this.#base.Name, `SELECT * FROM ${jtype.name}`);
			for (let row of rows) {
				let temp = await this.#toolbox.XmlToString(row.data);
				let data = {document: {}};
                if (temp?.Document) {
                	data.document.DocCity = Array.isArray(temp.Document?.DocCity) ? temp.Document?.DocCity[0] : "";
                	data.document.DocNum = Array.isArray(temp.Document?.DocNum) ? temp.Document?.DocNum[0] : "";
                    data.document.DocDate = Array.isArray(temp?.Document?.DocDate) ? temp?.Document?.DocDate[0] : "";
                    data.document.CodeWord = Array.isArray(temp.Document?.CodeWord) ? temp.Document?.CodeWord[0] : "";
                    data.document.MSISDN = Array.isArray(temp.Document?.MSISDN) ? temp.Document?.MSISDN[0] : "";
                    data.document.ICC = Array.isArray(temp.Document?.ICC) ? temp.Document?.ICC[0] : "";
                    data.document.ICCCTL = Array.isArray(temp.Document?.ICCCTL) ? temp.Document?.ICCCTL[0] : "";
                    data.document.FirstName = Array.isArray(temp.Document?.FirstName) ? temp.Document?.FirstName[0] : "";
                    data.document.SecondName = Array.isArray(temp.Document?.SecondName) ? temp.Document?.SecondName[0] : "";
                    data.document.LastName = Array.isArray(temp.Document?.LastName) ? temp.Document?.LastName[0] : "";
                    data.document.Birth = Array.isArray(temp.Document?.Birth) ? temp.Document?.Birth[0] : "";

                    data.document.FizDocNumber = Array.isArray(temp.Document?.FizDocNumber) ? temp.Document?.FizDocNumber[0] : "";
                    data.document.FizDocSeries = Array.isArray(temp.Document?.FizDocSeries) ? temp.Document?.FizDocSeries[0] : "";
                    data.document.FizDocOrgCode = Array.isArray(temp.Document?.FizDocOrgCode) ? temp.Document?.FizDocOrgCode[0] : "";
                    data.document.FizDocOrg = Array.isArray(temp.Document?.FizDocOrg) ? temp.Document?.FizDocOrg[0] : "";
                    data.document.FizDocDate = Array.isArray(temp.Document?.FizDocDate) ? temp.Document?.FizDocDate[0] : "";
                    data.document.FizBirthPlace = Array.isArray(temp.Document?.FizBirthPlace) ? temp.Document?.FizBirthPlace[0] : "";

                    data.document.AddrZip = Array.isArray(temp.Document?.AddrZip) ? temp.Document?.AddrZip[0] : "";
                    data.document.AddrStreet = Array.isArray(temp.Document?.AddrStreet) ? temp.Document?.AddrStreet[0] : "";
                    data.document.AddrStreetType = Array.isArray(temp.Document?.AddrStreetType) ? temp.Document?.AddrStreetType[0] : "";
                    data.document.AddrCity = Array.isArray(temp.Document?.AddrCity) ? temp.Document?.AddrCity[0] : "";
                    data.document.AddrCityType = Array.isArray(temp.Document?.AddrCityType) ? temp.Document?.AddrCityType[0] : "";
                    data.document.AddrHouse = Array.isArray(temp.Document?.AddrHouse) ? temp.Document?.AddrHouse[0] : "";
                    data.document.AddrBuilding = Array.isArray(temp.Document?.AddrBuilding) ? temp.Document?.AddrBuilding[0] : "";
                    data.document.AddrBuildingType = Array.isArray(temp.Document?.AddrBuildingType) ? temp.Document?.AddrBuildingType[0] : "";
                    data.document.AddrApartment = Array.isArray(temp.Document?.AddrApartment) ? temp.Document?.AddrApartment[0] : "";
                    if (data.document.AddrApartment == ".") data.document.AddrApartment = "";
                    data.document.AddrApartmentType = Array.isArray(temp.Document?.AddrApartmentType) ? temp.Document?.AddrApartmentType[0] : "";
                    data.document.AddrPhone = Array.isArray(temp.Document?.AddrPhone) ? temp.Document?.AddrPhone[0] : "";
                    data.document.AddrRegion = Array.isArray(temp.Document?.AddrRegion) ? temp.Document?.AddrRegion[0] : "";

                    data.document.ContactEmail = Array.isArray(temp.Document?.ContactEmail) ? temp.Document?.ContactEmail[0] : "";
                    data.document.FizInn = Array.isArray(temp.Document?.FizInn) ? temp.Document?.FizInn[0] : "";
                    data.document.ElSign = Array.isArray(temp.Document?.ElSign) ? temp.Document?.ElSign[0] : "";
                    data.document.DutyId = Array.isArray(temp.Document?.DutyId) ? temp.Document?.DutyId[0] : "";
                    data.document.AssignedDPCode = Array.isArray(temp.Document?.AssignedDPCode) ? temp.Document?.AssignedDPCode[0] : "";
                    // data.document.Plan = Array.isArray(temp.Document?.Plan) ? temp.Document?.Plan[0] : "";

              		// пол
                    if (temp.Document?.Sex) {
                        data.document.Sex = this.#rules.Sex(parseInt(temp.Document?.Sex[0]));
                    }
                    // фирменный салон связи или нет
                    if (Array.isArray(temp.Document?.fs)) {
                        data.document.Fs = this.#rules.Fs(temp.Document.fs);
                    } else data.document.Fs = 2;

                    // юзер
                    let userId;
                    if (row.userid == "dex") userId = "";
                    else {
                        userId = this.#rules.UserId(row.userid);
                        if (userId == "" && arr.indexOf(row.userid) == -1) {
                        	arr.push(row.userid);
                        	console.log(`нет userid для >${row.userid}< row.id=> База ${this.#base.BaseName}`, row.id);
                        }
                    }

                   	//  резидентство
                   	if (temp.Document?.DocClientType && Array.isArray(temp.Document?.DocClientType)) {
                   		if (this.#operator == "MEGAFON"  || this.#operator == "YOTA") {
	                        data.document.DocClientType = this.#rules.DocClientType(temp.Document?.DocClientType[0]);
	                    } else if (this.#operator == "MTS") {
	                    	try {
	                    		data.document.DocClientType = temp.Document?.DocCategory ? this.#rules.DocClientType(temp.Document?.DocCategory[0]) : "";
	                    	} catch(e) {
	                    		console.log(row.id);
	                    		console.log(e);
	                    	}
	                    } 
                   	} else data.document.DocClientType = "";
                    

                    // // страна
                	if (temp.Document?.AddrCountry) {
                        data.document.AddrCountry = this.#rules.GetCountry(temp.Document?.AddrCountry[0]);
                        if (data.document.AddrCountry == "" && Array.isArray(temp.Document?.AddrCountry) && temp.Document?.AddrCountry[0] != "") {
                        	 if (arr.indexOf(temp.Document.AddrCountry[0]) == -1) {
                                arr.push(temp.Document.AddrCountry[0]);
                                console.log(`"${temp.Document.AddrCountry[0].toLowerCase()}",`);
                                console.log(`для >${temp.Document?.AddrCountry[0]}< нет значения страны. id = ${row.id}. База ${this.#base.BaseName}`);
                            }
                        }
                    } else {
                    	data.document.AddrCountry = "";
                    }

                    // регион
                    if (temp.Document?.AddrState) {
                        data.document.AddrState = this.#rules.AddrState(temp.Document?.AddrState[0]);
                        if (data.document.AddrState == "" && Array.isArray(temp.Document?.AddrState) && temp.Document?.AddrState[0] != "") {
                            if (arr.indexOf(temp.Document.AddrState[0]) == -1) {
                                arr.push(temp.Document.AddrState[0]);
                                console.log(`"${temp.Document.AddrState[0].toLowerCase()}",`);
                            }
                        }
                    }

                    // профиль отправки
                    if (temp?.Document?.ProfileCode) {
                    	data.document.ProfileCode = this.#rules.GetProfileCode(temp?.Document?.ProfileCode);
                    }

                    // спец поля оператора
                    data.document.SpecialFields = [];
                    if (this.#operator == "MEGAFON") {
                    	let customerId = temp?.Document?.customerId ? temp?.Document?.customerId : "";
                    	data.document.SpecialFields.push({name: "customerId", value: customerId});
                    	let sbmsPaccount = temp?.Document?.sbms_paccount ? temp?.Document?.sbms_paccount : "";
                    	data.document.SpecialFields.push({name: "sbmsPaccount", value: sbmsPaccount});
                    } else if (this.#operator == "BEELINE") {
                    	let absCode = temp?.Document?.ABSCode ? temp?.Document?.ABSCode : "";
                    	data.document.SpecialFields.push({name: "absCode", value: absCode});
                    }

                    // гражданство
					if (temp.Document?.FizDocCitizen && Array.isArray(temp.Document.FizDocCitizen)) {
						if (this.#operator == "MTS") {
							data.document.Citizenship = temp.Document?.FizDocCitizen[0]?.$?.tag ? this.#rules.GetCountry(parseInt(temp.Document?.FizDocCitizen[0]?.$?.tag)) : "";
							if (data.document.Citizenship == "") {
								if (temp.Document?.FizDocCitizen[0]?.$?.tag == "Российская Федерация") {
									data.document.Citizenship = 235
								} else if (temp.Document?.FizDocCitizen[0] == "") {
									data.document.Citizenship = "";
								} else if (arr.indexOf(parseInt(temp.Document?.FizDocCitizen[0]?.$?.tag)) == -1) {
									console.log("---temp.Document?.FizDocCitizen=> ", temp.Document?.FizDocCitizen);
	                                arr.push(parseInt(temp.Document?.FizDocCitizen[0]?.$?.tag));
	                                console.log(`---"${temp.Document?.FizDocCitizen[0]?.$?.tag}", `, temp.Document?.FizDocCitizen[0]?._, " id=>", row.id);
	                            }
							}
						} else if (this.#operator == "YOTA") {
							data.document.Citizenship = this.#rules.GetCountry(parseInt(temp.Document?.FizDocCitizen[0]));
							if (data.document.Citizenship == "") {
								if (Array.isArray(temp.Document?.FizDocCitizen) && temp.Document?.FizDocCitizen[0] != "") {
		                        	if (arr.indexOf(temp.Document.FizDocCitizen[0]) == -1) {
		                                arr.push(temp.Document.FizDocCitizen[0]);
		                                console.log(`+++"${temp.Document.FizDocCitizen[0].toLowerCase()}",`);
		                                console.log("+++temp.Document?.FizDocCitizen=> ", temp.Document?.FizDocCitizen);
		                            }
		                        }
	                    	}
						}
					}   

                    // тип документа
                    let docType = 1;// 1 - вручную. 2 - автоматически автодоком, 3 - автоматически из выгрузки из удаленки оператора. Данные не полные. 4 - на основании другого документа
                    if (this.#operator == "MTS" || this.#operator == "BEELINE") {
                    	if (temp.Document?.FizDocType && Array.isArray(temp.Document?.FizDocType)) {
                    		if (temp.Document?.FizDocType[0]?._) {
	                    		data.document.FizDocType = this.#rules.FizDocType(parseInt(temp.Document?.FizDocType[0]?._));
	                    	} else {
	                    		data.document.FizDocType = this.#rules.FizDocType(parseInt(temp.Document?.FizDocType[0]));
	                    	}
                    	} else data.document.FizDocType = "";
                    } else if (this.#operator == "MEGAFON" || this.#operator == "YOTA") {
                    	if (temp.Document?.gf && Array.isArray(temp.Document?.gf) && temp.Document?.gf[0] == "True") {
	                        try {
	                            data.document.FizDocType = this.#rules.FizDocTypeNew(parseInt(temp.Document?.FizDocType[0]));
	                        } catch(e) {
	                            docType = 3;
	                        }
	                    } else {
	                        try {
	                            if (this.#toolbox.IsNumber(temp.Document?.FizDocType[0])) {
	                                data.document.FizDocType = this.#rules.FizDocTypeOld(parseInt(temp.Document?.FizDocType[0]));
	                            } else {
	                                data.document.FizDocType = this.#rules.FizDocTypeOldString(temp.Document?.FizDocType[0]);
	                                if (data.document.FizDocType == 14) {
		                    			data.document.FizDocOtherType = temp.Document?.FizDocOtherDocTypes ? this.#rules.FizDocTypeOldString(temp.Document?.FizDocOtherDocTypes[0]) : "";
		                    			if (data.document.FizDocOtherType == "" && arr.indexOf(data.document.FizDocOtherType) == -1) {
				                    		arr.push(temp.Document?.FizDocOtherDocTypes[0]);
				                    		console.log("Тип документа отсутствует для id = ", row.id, " ==> ", temp.Document?.FizDocOtherDocTypes[0]);
			                    		}
		                    		}
	                            }
	                        } catch(e) {
	                            docType = 3;
	                        }
	                    }
                    }

                    if (data.document.FizDocType == "" && temp.Document?.FizDocType) {
                    	if (this.#operator == "YOTA") {
                    		if (data.document.FizDocType == 14) {
                    			data.document.FizDocOtherType = temp.Document?.FizDocOtherDocTypes ? this.#rules.FizDocTypeOldString(temp.Document?.FizDocOtherDocTypes[0]) : "";
                    			if (arr.indexOf(temp.Document?.FizDocOtherDocTypes[0]) == -1) {
		                    		arr.push(temp.Document?.FizDocOtherDocTypes[0]);
		                    		console.log("Тип документа отсутствует для id = ", row.id, " ==> ", temp.Document?.FizDocOtherDocTypes[0]);
	                    		}
                    		} else {
                    			if (arr.indexOf(temp.Document?.FizDocType[0]) == -1) {
		                    		arr.push(temp.Document?.FizDocType[0]);
		                    		console.log("Тип документа отсутствует для id = ", row.id, " ==> ", temp.Document?.FizDocType[0]);
	                    		}
                    		}
                    	} else if (typeof temp.Document?.FizDocType[0]?._ === "undefined") {
                    		data.document.FizDocType = "";
                    	} else if (arr.indexOf(parseInt(temp.Document?.FizDocType[0]?._)) == -1) {
                    		arr.push(parseInt(temp.Document?.FizDocType[0]?._));
                    		console.log("Тип документа отсутствует для id = ", row.id, " ==> ", temp.Document?.FizDocType[0]?._);
                    	}
                    } 

                    // страна выдачи документа
                    if (this.#operator == "MTS" && temp.Document?.FizDocCountry && Array.isArray(temp.Document?.FizDocCountry)) {
                    	if (temp.Document?.FizDocCountry && Array.isArray(temp.Document?.FizDocCountry)) {
                    		if (temp.Document?.FizDocCountry[0]?._) {
	                    		data.document.FizDocCountry = this.#rules.FizDocType(parseInt(temp.Document?.FizDocCountry[0]?._));
	                    	} else {
	                    		data.document.FizDocCountry = this.#rules.FizDocType(parseInt(temp.Document?.FizDocCountry[0]));
	                    	}
                    	} else data.document.FizDocCountry = "";                    	
                    }


                    for (let key in data.document) data.document[key] = this.#toolbox.HtmlSpecialChars(data.document[key]);
                    for (let key in data.document.SpecialFields) data.document.SpecialFields[key] = this.#toolbox.HtmlSpecialChars(data.document.SpecialFields[key]);

                    // // если docType == 1, надо бы тогда с журналом разобраться
                    if (docType == 1) {
                        let logs = await this.#toolbox.XmlToString(row.journal);
                        if (logs && logs?.journal?.record && logs?.journal?.record[0]) {
                            if (logs.journal.record[0]?.text && logs.journal.record[0]?.text == "Документ сформирован функцией формирования группы документов") {
                                docType = 2;
                            } else if (logs.journal.record[0]?.text && logs.journal.record[0]?.text == "Документ на основе другого документа добавлен в журнал") {
                                docType = 4;
                            }
                        } else if (logs && logs?.root?.record && logs?.root?.record[0]) {
                        	if (logs?.root?.record[0]?.text && logs?.root?.record[0]?.text == "Документ сформирован функцией формирования группы документов") {
                                docType = 2;
                            } else if (logs?.root?.record[0]?.text && logs?.root?.record[0]?.text == "Документ на основе другого документа добавлен в журнал") {
                                docType = 4;
                            }
                        } else if (logs && logs?.root?.journal) {
                        	if (logs?.root?.journal?.record && logs?.root?.journal?.record[0]?.text == "Документ сформирован функцией формирования группы документов") {
                                docType = 2;
                            } else if (logs?.root?.journal?.record && logs?.root?.journal?.record[0]?.text == "Документ на основе другого документа добавлен в журнал") {
                                docType = 4;
                            }
                        } else if (logs && logs?.journal == "") {
                        	logs = {};
                        	docType = 2;
                        } else { 
                        	if (!logs) {
                        		logs = {};
                        		docType = 2;
                        	} else {
                        		console.log(logs);
                        		console.log("для записи ", row.id, " журнал вполне возможно с ошибкой");
                        	}
                        }
                    }

                    

                    let time = date(row.signature, "YYYYMMDDhhmmssSSS").format("YYYY-MM-DD hh:mm:ss.SSS");
           

                    let value = `('${userId}','${jtype.id}','${row.unitid}','${row.status}','${row.signature}','${row.jdocdate}','${JSON.stringify(data)}','${docType}')`;
                    inserts.push(value);


                    if (inserts.length == 100 || cnt == rows.length - 1) {
                        if (inserts.length > 0) {
                            let result = await this.#connector.Request("dexol", `
                                INSERT INTO ${this.#base.BaseName} (userId, jtype, store, status, signature, jdocdate, data, type)
                                VALUES ${inserts.join(",")}
                            `);
                            // console.log(result);
                            if (inserts.length != result.affectedRows) console.log("не соответствует");
                            inserts = [];
                        }
                    }

                }
                if (arr.length > 40) break;
                cnt++;
			}
        }

        console.log(`Конвертер для базы ${this.#base.BaseName} закончил работу`);
	}
}

module.exports = Converter;