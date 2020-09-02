const InfoParser = require('../../InfoParser.js');
const puppeteer = require('puppeteer');
const ConfigReader = require('../../ConfigReader.js');
const ErrorLogger = require("../../ErrorLogger.js");
const DateHandler = require("../../DateHandler.js");
const Agent = require("random-useragent");

const ERROR_LOGGER = new ErrorLogger('delaware');
const CONFIG = new ConfigReader('delaware');


let Scraper = function(){
	this.getTableDataBySelector = async function(page, selector, html){
		if(html){
			return await page.$$eval(selector, rows => {
			  return Array.from(rows, row => {
			    const columns = row.querySelectorAll('td, th');
			    const datum = Array.from(columns, column => column.outerHTML);
			    return datum;
				  });

			});
		} else {
			return await page.$$eval(selector, rows => {
			  return Array.from(rows, row => {
			    const columns = row.querySelectorAll('td, th');
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


	this.scrapeByPropertyURL = async function(page, propertyURL){
		if(propertyURL === undefined){
			return {
				scraped_information: [],
				return_status: CONFIG.DEV_CONFIG.PAGE_ACCESS_ERROR_CODE
			}
		}
		
		for(visitAttemptCount = 0; visitAttemptCount < CONFIG.DEV_CONFIG.MAX_VISIT_ATTEMPTS; visitAttemptCount++){
			try{
				await page.goto(propertyURL);
			
				await page.waitForSelector("section#ctlBodyPane_ctl01_mSection", {timeout: CONFIG.DEV_CONFIG.PARCEL_TIMEOUT_MSEC});
				await page.waitFor(200);
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
		

		// const parcelIDString = (await (await (await page.$('.DataletHeaderTopLeft')).getProperty('innerText')).jsonValue());
		// const parcelID = parcelIDString.substring(parcelIDString.indexOf(':')+2);

		let owner1Handle = await page.$('span#ctlBodyPane_ctl01_ctl01_lstOwner_ctl02_lblOwnerAddress');
		// let owner1Link = await page.$('a#ctlBodyPane_ctl01_ctl01_lnkOwnerName1_lnkSearch');
		let prop, ownerInfo, baseOwnerName;;
		if(owner1Handle) {
			prop = await owner1Handle.getProperty('innerText');
		// else if(owner1Link) prop = await owner1Link.getProperty('innerText');
			ownerInfo = await prop.jsonValue();
			ownerInfo = ownerInfo.split('\u000A');
			baseOwnerName = ownerInfo[1];
		}


		let mailingHandle = await page.$('span#ctlBodyPane_ctl01_ctl01_lstOwner_ctl00_lblOwnerAddress');
		prop = await mailingHandle.getProperty('innerText');
		let taxInfo = await prop.jsonValue();
		taxInfo = taxInfo.split('\u000A');
		taxInfo.shift();
		let taxName = taxInfo.shift();
		let taxAddress = taxInfo.join(' ');
		if(baseOwnerName === undefined && taxName) {
			baseOwnerName = taxName;
			taxName = undefined;
		}
		console.log(baseOwnerName);

		console.log(taxName);
		console.log(taxAddress);

		let salesTableData = await this.getTableDataBySelector(page, "table#ctlBodyPane_ctl08_ctl01_grdTransferHistory > tbody > tr",false);
		salesTableData = salesTableData.shift();
		let transferAmount = '', transferDate = '';
		if(salesTableData !== undefined){
			transferAmount = salesTableData[1];
			transferDate = salesTableData[0];
		}


		if(transferAmount.trim() !== '') transferAmount = parseInt(transferAmount.replace(/[,\$]/g, ''));
		else transferAmount = undefined;
		if(transferDate.trim() !== '') transferDate = DateHandler.formatDate(new Date(transferDate));
		else transferAmount = undefined;

		console.log(transferAmount);
		console.log(transferDate);
		
		console.log('\n');


		let scrapedInfo = [undefined, transferDate, transferAmount, baseOwnerName, undefined, undefined, taxName, taxAddress, undefined, undefined, undefined]; 
		
		
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
		
		let prefixLength = 13 - parcelID.length;
		if(prefixLength > 0) parcelID = "0".repeat(prefixLength) + parcelID;

		let visitAttemptCount;
		for(visitAttemptCount = 0; visitAttemptCount < CONFIG.DEV_CONFIG.MAX_VISIT_ATTEMPTS; visitAttemptCount++){
			try{

				
				await page.goto(auditorURL);
				await page.waitForSelector("div.modal-footer > a.btn", {timeout: CONFIG.DEV_CONFIG.ACK_TIMEOUT_MSEC});
				await page.waitFor(200);
				let ackButton = await page.$("div.modal-footer > a.btn");
				await ackButton.click();
				await page.waitFor(200);
				throw "Acknowledge Button Clicked";
				
			}
			catch(e){
				// console.log(e);
				try{
			
					await page.waitForSelector("input#ctlBodyPane_ctl02_ctl01_txtParcelID");
					await page.click('input#ctlBodyPane_ctl02_ctl01_txtParcelID', {clickCount: 3});					
					await page.type('input#ctlBodyPane_ctl02_ctl01_txtParcelID', parcelID);
					const searchButton = await page.$('a#ctlBodyPane_ctl02_ctl01_btnSearch');
					await searchButton.click();
					await page.waitFor(200);
					await page.waitForSelector("section#ctlBodyPane_ctl01_mSection", {timeout: CONFIG.DEV_CONFIG.PARCEL_TIMEOUT_MSEC});
					await page.waitFor(200);
				
				} catch(e){
					console.log(e);
					console.log('Unable to visit ' + auditorURL + '. Attempt #' + visitAttemptCount);
					continue;
				}
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

		let scrapedInfo = await this.scrapeByPropertyURL(page, propertyURL);
		scrapedInfo.scraped_information[CONFIG.DEV_CONFIG.PROP_URL_IDX] = propertyURL;
		
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
async function run(){
	const browser = await puppeteer.launch({headless: false, slowMo: 5});
	const page = await browser.newPage();
	const scrape = new Scraper();
	let allHyperlinks = await scrape.getParcelIDHyperlinksForDate(page);
	let processedInformation = await scrape.processHyperLinks(page, allHyperlinks, infoValidator);
}

// run();
