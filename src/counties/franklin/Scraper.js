const InfoParser = require('../../InfoParser.js');
const puppeteer = require('puppeteer');
const ConfigReader = require('../../ConfigReader.js');
const ErrorLogger = require("../../ErrorLogger.js");
const DateHandler = require("../../DateHandler.js");

const ERROR_LOGGER = new ErrorLogger('delaware');
const CONFIG = new ConfigReader('delaware');


let Scraper = function(){
	this.getTableDataBySelector = async function(page, selector, html){
		if(html){
			return await page.$$eval(selector, rows => {
			  return Array.from(rows, row => {
			    const columns = row.querySelectorAll('td');
			    const datum = Array.from(columns, column => column.outerHTML);
			    return datum;
				  });

			});
		} else {
			return await page.$$eval(selector, rows => {
			  return Array.from(rows, row => {
			    const columns = row.querySelectorAll('td');
			    const datum = Array.from(columns, column => column.innerText);
			    return datum;
				  });

			});
		}

		
	}

	this.getInfoFromTableByRowHeader = async function(table, header, delimiter){
		let inTargetHeader = false;
		let info = '';
		for(let i = 0; i < table.length; i++){
			let row = table[i];
			let rowHeader = row[0].trim();
			if(inTargetHeader){
				if(rowHeader === ''){
					info += delimiter + ' ' + row[row.length - 1];
				} else {
					inTargetHeader = false;
					break;
				}
			} 
			else if(rowHeader === header){
				inTargetHeader = true;
				info += row[row.length-1];
			} 
		}
		return info;
	}
	this.getInfoFromTableByColumnHeader = async function(table, header, rowNum){
		let headers = table.shift();
		// console.log(headers);
		// console.log(header);
		let colIndex = headers.indexOf(header);
		if(colIndex > 0){
			return table[rowNum][colIndex];
		} else {
			return 'ERR'
		}
	}


	this.scrapeByPropertyURL = async function(page, propertyURL, parcelID){
		if(propertyURL === undefined){
			return {
				scraped_information: [],
				return_status: CONFIG.DEV_CONFIG.PAGE_ACCESS_ERROR_CODE
			}
		}
		// console.log('Receive call to property with URL: '+propertyURL);
		const treasurerURL = 'https://treapropsearch.franklincountyohio.gov/';
		for(visitAttemptCount = 0; visitAttemptCount < CONFIG.DEV_CONFIG.MAX_VISIT_ATTEMPTS; visitAttemptCount++){
			
			try{
				await page.goto(propertyURL);
				await page.waitForSelector("table#Owner", {timeout: CONFIG.DEV_CONFIG.PARCEL_TIMEOUT_MSEC});
				await page.waitFor(200);
				const ownerTableData = await this.getTableDataBySelector(page, "table#Owner tr",false);
				
				if(ownerTableData.length < 1){
					throw "Owner Table Not Found";
				}
			}
			catch(e){
				// console.log(e);
				console.log('Unable to visit ' + propertyURL + '. Attempt #' + visitAttemptCount);
				continue;
			}
		
			
			break;	
		}

		if(visitAttemptCount === CONFIG.DEV_CONFIG.MAX_VISIT_ATTEMPTS){
			console.log('Failed to reach ' + propertyURL + '. Giving up.');
			return {
				return_status: CONFIG.DEV_CONFIG.PAGE_ACCESS_ERROR_CODE,
				scraped_information: []
			};
		}
		
		const ownerTableData = await this.getTableDataBySelector(page, "table#Owner tr",false);
			// console.log('Owner Table Data:');
			// console.log(ownerTableData);
		let ownerNames = await this.getInfoFromTableByRowHeader(ownerTableData, 'Owner', '');
		console.log(ownerNames);
		let ownerAddress = await this.getInfoFromTableByRowHeader(ownerTableData, 'Owner Address','');	
		console.log(ownerAddress);
		// const parcelIDString = (await (await (await page.$('.DataletHeaderTopLeft')).getProperty('innerText')).jsonValue());
		// const parcelID = parcelIDString.substring(parcelIDString.indexOf(':')+2);

		const transferTableData = await this.getTableDataBySelector(page, "table[id*='Transfer'] tr",false);
		// console.log(transferTableData);
		let transferAmount = await this.getInfoFromTableByRowHeader(transferTableData,'Transfer Price','');
		transferAmount = parseInt(transferAmount.replace(/[,\$]/g, ''));
		console.log(transferAmount);
		let transferDate = await this.getInfoFromTableByRowHeader(transferTableData,'Transfer Date','');
		transferDate = DateHandler.formatDate(new Date(transferDate));
		console.log(transferDate);

		if(isNaN(transferAmount)) {
			transferAmount = undefined;
			transferDate = undefined;
		}

		let scrapedInfo = [undefined, transferDate, transferAmount, ownerNames, undefined, ownerAddress, undefined, undefined, undefined, undefined, undefined]; 
		
		let taxName, taxAddress;
		for(visitAttemptCount = 0; visitAttemptCount < CONFIG.DEV_CONFIG.MAX_VISIT_ATTEMPTS; visitAttemptCount++){
			
			try{
				await page.goto(treasurerURL);
				await page.waitForSelector("input#ctl00_cphBodyContent_sbPropertySearch_rbSearchByParcelID", {timeout: CONFIG.DEV_CONFIG.PARCEL_TIMEOUT_MSEC});
				await page.waitFor(200);

				const parcelButton = await page.$('input#ctl00_cphBodyContent_sbPropertySearch_rbSearchByParcelID');
				parcelButton.click();

				await page.waitForSelector('input#ctl00_cphBodyContent_sbPropertySearch_tbSearch');

				await page.click('input#ctl00_cphBodyContent_sbPropertySearch_tbSearch', {clickCount: 3});
				await page.type('input#ctl00_cphBodyContent_sbPropertySearch_tbSearch', parcelID);
				await page.keyboard.press("Tab");

				await page.waitFor(200);
				await page.click('input#ctl00_cphBodyContent_sbPropertySearch_btnSearch');

				await page.waitFor('span#ctl00_cphBodyContent_fcDetailsHeader_MailingPersonName1');
				let span = await page.$('span#ctl00_cphBodyContent_fcDetailsHeader_MailingPersonName1');
				taxName = (await (await span.getProperty('innerText')).jsonValue());

				span = await page.$('span#ctl00_cphBodyContent_fcDetailsHeader_MailingAddressLine1');
				taxAddress = (await (await span.getProperty('innerText')).jsonValue());

				span = await page.$('span#ctl00_cphBodyContent_fcDetailsHeader_MailingAddressLine2');
				taxAddress += ' ' + (await (await span.getProperty('innerText')).jsonValue());

				span = await page.$('span#ctl00_cphBodyContent_fcDetailsHeader_MCSZ');
				taxAddress += ' ' + (await (await span.getProperty('innerText')).jsonValue());				
				
				if(ownerTableData.length < 1){
					throw "Owner Table Not Found";
				}
			}
			catch(e){
				// console.log(e);
				console.log('Unable to find mailing tax info, attempt #' + visitAttemptCount);
				continue;
			}
		
			
			break;	
		}


		if(visitAttemptCount < CONFIG.DEV_CONFIG.MAX_VISIT_ATTEMPTS){
			console.log(taxName);
			console.log(taxAddress);
			scrapedInfo[CONFIG.DEV_CONFIG.TAX_OWNER_IDX] = taxName;
			scrapedInfo[CONFIG.DEV_CONFIG.TAX_ADDRESS_IDX] = taxAddress;
		}

		console.log('\n');

		return {
			scraped_information: scrapedInfo,
			return_status: CONFIG.DEV_CONFIG.SUCCESS_CODE
		};
	}

	this.scrapeByAuditorURL = async function(page, auditorURL, parcelID){
		if(auditorURL === undefined){
			return {
				scraped_information: [],
				return_status: CONFIG.DEV_CONFIG.PAGE_ACCESS_ERROR_CODE
			}
		}
		// console.log('Received call to auditor with parcelID: ' + parcelID);
		let visitAttemptCount;
		for(visitAttemptCount = 0; visitAttemptCount < CONFIG.DEV_CONFIG.MAX_VISIT_ATTEMPTS; visitAttemptCount++){
		
			try{
				await page.goto(auditorURL);

				await page.waitForSelector("input#inpParid");
				await page.click('input#inpParid', {clickCount: 3});					
				await page.type('input#inpParid', parcelID);
				const searchButton = await page.$('button#btSearch');
				await searchButton.click();
				
				await page.waitForSelector("table#Owner", {timeout: CONFIG.DEV_CONFIG.PARCEL_TIMEOUT_MSEC});
				await page.waitFor(200);
				
				const ownerTableData = await this.getTableDataBySelector(page, "table#Owner tr",false);
				
				if(ownerTableData.length < 1){
					throw "Owner Table Not Found";
				}
				
			}
			catch(e){
				console.log(e);
				console.log('Unable to visit ' + auditorURL + '. Attempt #' + visitAttemptCount);
				continue;
			}
		
			
			break;	
		}

		if(visitAttemptCount === CONFIG.DEV_CONFIG.MAX_VISIT_ATTEMPTS){
			console.log('Failed to reach ' + auditorURL + '. Giving up.');
			return {
				return_status: CONFIG.DEV_CONFIG.PAGE_ACCESS_ERROR_CODE,
				scraped_information: []
			};
		}
		
		let propertyURL = page.url();
		// console.log('Making a call to property');
		let scrapedInfo = await this.scrapeByPropertyURL(page, propertyURL, parcelID);
		// scrapedInfo.scraped_information[CONFIG.DEV_CONFIG.PROP_URL_IDX] = propertyURL;
		
		return {
			scraped_information: scrapedInfo.scraped_information,
			return_status: CONFIG.DEV_CONFIG.SUCCESS_CODE
		};
	}

}


module.exports = Scraper

function infoValidator(info, processedInformation){
	let valid = false;
	if(info.transfer < info.value && info.transfer > 0) valid = true;
	if(processedInformation.some(e => e.owner === info.owner)) valid = false;	
	return valid;
	
}	


// run();
