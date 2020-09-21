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
			    const columns = row.querySelectorAll('th, td');
			    const datum = Array.from(columns, column => column.outerHTML);
			    return datum;
				  });

			});
		} else {
			return await page.$$eval(selector, rows => {
			  return Array.from(rows, row => {
			    const columns = row.querySelectorAll('th, td');
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
				
				await page.waitForSelector("#pnlOnTracParcel table", {timeout: CONFIG.DEV_CONFIG.PARCEL_TIMEOUT_MSEC});
				await page.waitFor(200);
				
			}
			catch(e){
				// console.log(e);
				console.log('Unable to visit ' + propertyURL + '. Attempt #' + visitAttemptCount);
				await page.goto(propertyURL);

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


		let ownerTableData = await this.getTableDataBySelector(page, "#pnlOnTracParcel table tr", false);
		ownerTableData = ownerTableData.map(row => row.filter(e => e.length > 0));

		let ownerNameData = ownerTableData.filter(row => row.includes('Owner:'))[0];
		let baseOwnerName;
		if(ownerNameData !== undefined) baseOwnerName = ownerNameData[ownerNameData.indexOf('Owner:') + 1];

		console.log(baseOwnerName);

		let ownerAddressData = ownerTableData.filter(row => row.includes('Owner Mailing Address:'))[0];
		let ownerName, ownerAddress;
		if(ownerAddressData !== undefined) {
			let ownerMailingData = ownerAddressData[ownerAddressData.indexOf('Owner Mailing Address:') + 1];
			ownerMailingData = ownerMailingData.split('\n');
			ownerName = ownerMailingData.shift();
			ownerAddress = ownerMailingData.join(' ');
		}

		console.log(ownerName);
		console.log(ownerAddress);

		let taxData = ownerTableData.filter(row => row.includes('Mailing Address:'))[0];
		let taxName, taxAddress;
		if(taxData !== undefined) {
			let taxMailingData = taxData[taxData.indexOf('Mailing Address:') + 1];
			taxMailingData = taxMailingData.split('\n');
			taxName = taxMailingData.shift();
			taxAddress = taxMailingData.join(' ');
		}

		console.log(taxName);
		console.log(taxAddress);

		// console.log(ownerTableData);

		let scrapedInfo = [undefined, undefined, undefined, baseOwnerName, ownerName, ownerAddress, taxName, taxAddress, undefined, undefined, undefined]; 
		
		for(visitAttemptCount = 0; visitAttemptCount < 1; visitAttemptCount++){
			try{
				let transferTag;
				let sideMenu = await page.$$("#accSideMenuTop a");
				
				for(let i = 0; i < sideMenu.length; i++){
					handle = sideMenu[i];
					let prop = await handle.getProperty('innerText');
					let propJSON = await prop.jsonValue();
					// console.log(propJSON);
					if(propJSON.includes('Transfers')) transferTag = handle;
				}
				await transferTag.click();
				await page.waitForSelector("#gvTransfers", {timeout: CONFIG.DEV_CONFIG.SEARCH_TIMEOUT_MSEC});
			}
			catch(e){
				console.log(e);
				console.log('Unable to visit transfers. Attempt #' + visitAttemptCount);
				await page.goto(propertyURL);
				visitAttemptCount++;
			}
			break;	
		}
		if(visitAttemptCount === 1){
			console.log('Failed to reach sales. Giving up.');
			
		} else {
			let conveyanceTableData = await this.getTableDataBySelector(page, "#gvTransfers tr", false);
			conveyanceTableData.shift();
			// console.log(conveyanceTableData);
			let dates = conveyanceTableData.map(row => new Date(row[1]));
			let maxDateIdx = 0;
			for(let i = 1; i < dates.length; i++){
				let currDate = dates[i];
				if(currDate >= dates[maxDateIdx]){
					maxDateIdx = i;
				}
			}
			let latestTransferData = conveyanceTableData[maxDateIdx];
			// console.log(latestTransferData);
			// console.log(latestTransferData);
			let transferDate = '', transferAmount = '';
			if(latestTransferData !== undefined){
				
				transferDate = latestTransferData[1];

				transferAmount = latestTransferData[5];
				
				// console.log(transferAmount);
			}
			if(transferAmount.trim() !== '') transferAmount = parseInt(transferAmount.replace(/[,\$]/g, ''));
			else transferAmount = undefined;
			if(transferDate.trim() !== '') transferDate = DateHandler.formatDate(new Date(transferDate));
			else transferDate = undefined;

			console.log(transferAmount);
			console.log(transferDate);


			scrapedInfo[CONFIG.DEV_CONFIG.DATE_IDX] = transferDate;
			scrapedInfo[CONFIG.DEV_CONFIG.PRICE_IDX] = transferAmount;
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
		parcelID = parcelID.replace(/[-.]/g,'');

		for(visitAttemptCount = 0; visitAttemptCount < CONFIG.DEV_CONFIG.MAX_VISIT_ATTEMPTS; visitAttemptCount++){
			try{
				await page.goto(auditorURL);
				await page.waitForFunction("document.getElementById('modal').style['display'] === 'none'", {timeout: CONFIG.DEV_CONFIG.PARCEL_TIMEOUT_MSEC});
				await page.waitForSelector("#cmbSearchBy", {timeout: CONFIG.DEV_CONFIG.ACK_TIMEOUT_MSEC});
				await page.select("#cmbSearchBy", "Parcel #");
				await page.waitFor(200);
				await page.type("#txtSearch", parcelID);
				await page.waitFor(200);

				await page.keyboard.press("Enter");
				await page.waitFor(2000);

				await page.waitForSelector('#lblSummaryOwnerRO', {timeout: CONFIG.DEV_CONFIG.SEARCH_TIMEOUT_MSEC})
				// let getTableDataBySelector = this.getTableDataBySelector;
				
				const selector = '#lblSummaryOwnerRO';
				await page.waitForFunction(
				    selector => !document.querySelector(selector).innerText.includes("LICKING COUNTY"),
				    {},
				    selector
				);
				

				await page.waitForSelector("#pnlOnTracParcel table", {timeout: CONFIG.DEV_CONFIG.SEARCH_TIMEOUT_MSEC});
				await page.waitFor(200);


				
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

		let scrapedInfo = await this.scrapeByPropertyURL(page, propertyURL);
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
async function run(){
	const browser = await puppeteer.launch({headless: false, slowMo: 5});
	const page = await browser.newPage();
	const scrape = new Scraper();
	let allHyperlinks = await scrape.getParcelIDHyperlinksForDate(page);
	let processedInformation = await scrape.processHyperLinks(page, allHyperlinks, infoValidator);
}

// run();
