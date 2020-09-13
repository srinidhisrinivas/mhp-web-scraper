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
					if(!row[row.length - 1].includes("LIEN") && !row[row.length - 1].includes("SOLD")) info += delimiter + ' ' + row[row.length - 1];
				} else {
					inTargetHeader = false;
					break;
				}
			} 
			else if(rowHeader.includes(header)){
				inTargetHeader = true;
				info += row[row.length-1];
			} 
		}
		
		return info;
	}
	this.getInfoFromTableByColumnHeader = async function(table, header, rowNum){
		let headers = table[0];
		// console.log(headers);
		// console.log(header);
		let colIndex = headers.indexOf(header);

		if(colIndex >= 0){
			return table[rowNum + 1][colIndex];
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
		for(visitAttemptCount = 0; visitAttemptCount < CONFIG.DEV_CONFIG.MAX_VISIT_ATTEMPTS; visitAttemptCount++){
			
			try{
				await page.goto(propertyURL);
				await page.waitForSelector("table[id*='FullContent']", {timeout: CONFIG.DEV_CONFIG.PARCEL_TIMEOUT_MSEC});
				await page.waitFor(200);
				const ownerTableData = await this.getTableDataBySelector(page, "table[id*='FullContent'] tr",false);
				
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
		let ownerTableData = await this.getTableDataBySelector(page, "table[id*='FullContent'] tr",false);
		ownerTableData = ownerTableData.map(row => row.map(e => { e = e.trim(); e = e.replace(/\t /g, ''); return e;}));
		ownerTableData = ownerTableData.filter(row => row.length > 0);
		// ownerTableData = ownerTableData.filter(row => row.some(e => e.includes('Owner Name') || e.includes('Mailing') || e.includes('Latest Sale')));

		let ownerData = ownerTableData.filter(row => row.includes('Owner Name') || row.includes('Mailing Address') || row.includes('Mailing Name'));
		ownerData = ownerData.filter(row => row.length < 4);
		let ownerNames = ownerData.filter(row => row.includes('Owner Name'))[0][1];
		let taxName = ownerData.filter(row => row.includes('Mailing Name'))[0][1];
		let taxAddress = ownerData.filter(row => row.includes('Mailing Address'))[0][1].split('\n').join(' ');

		console.log(ownerNames);
		console.log(taxName);
		console.log(taxAddress);
		
		let saleTableData = await this.getTableDataBySelector(page, "table#FullContent_TabContainer_ParcelInfo_Tab_MainInfo_grd_Sale", false);
		saleTableData = saleTableData[0];
		// console.log(saleTableData);

		let transferAmount = '', transferDate = '';

		let amtIdx = saleTableData.indexOf('Sale Amount') + 1;
		let dateIdx = saleTableData.indexOf('Sale Date') + 1;


		if(amtIdx !== 0) transferAmount = saleTableData[amtIdx];
		if(dateIdx !== 0) transferDate = saleTableData[dateIdx];	

		if(transferAmount.trim() !== '') transferAmount = parseInt(transferAmount.replace(/[,\$]/g, ''));
		else transferAmount = undefined;
		if(transferDate.trim() !== '') transferDate = DateHandler.formatDate(new Date(transferDate));
		else transferDate = undefined;

		console.log(transferAmount);
		console.log(transferDate);
		

		let scrapedInfo = [undefined, transferDate, transferAmount, ownerNames, undefined, undefined, taxName, taxAddress, undefined, undefined, undefined]; 
		
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
		
		let visitAttemptCount;
		for(visitAttemptCount = 0; visitAttemptCount < CONFIG.DEV_CONFIG.MAX_VISIT_ATTEMPTS; visitAttemptCount++){
		
			try{
				await page.goto(auditorURL);

				await page.waitForSelector("input#LeftSideContent_txtParSearch");
				await page.click('input#LeftSideContent_txtParSearch', {clickCount: 3});					
				await page.type('input#LeftSideContent_txtParSearch', parcelID);
				const searchButton = await page.$('input#LeftSideContent_btn_search');
				await searchButton.click();
				
				await page.waitForSelector('a#MainContent_grdvw_Assigned_hprlnk_AssignedParcelNumber_0', {timeout: CONFIG.DEV_CONFIG.PARCEL_TIMEOUT_MSEC});
				await page.waitFor(200);

				await page.click("a#MainContent_grdvw_Assigned_hprlnk_AssignedParcelNumber_0");
				await page.waitFor(200);

				await page.waitForSelector("table[id*='FullContent']", {timeout: CONFIG.DEV_CONFIG.PARCEL_TIMEOUT_MSEC});
				await page.waitFor(200);
				
				const ownerTableData = await this.getTableDataBySelector(page, "table[id*='FullContent'] tr",false);
				
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
		scrapedInfo.scraped_information[CONFIG.DEV_CONFIG.PROP_URL_IDX] = propertyURL;
		
		return {
			scraped_information: scrapedInfo.scraped_information,
			return_status: CONFIG.DEV_CONFIG.SUCCESS_CODE
		};
	}

}


module.exports = Scraper;


// run();
