const puppeteer = require('puppeteer');
const fs = require('fs');
const Excel = require('exceljs');
const ExcelWriter = require('./ExcelWriter.js');
const DateHandler = require('./DateHandler.js');
const InfoParser = require('./InfoParser.js');
// const Scraper = require('./Scraper.js');
// const DelScraper = require('./DelScraper.js');
const ConfigReader = require('./ConfigReader.js');
const LAYOUT_COUNTY_LIST = ['adams',
							'allen',
							'ashtabula',
							'athens',
							'auglaize',
							'brown',
							'butler',
							'champaign',
							'clermont',
							'clinton',
							'coshocton',
							'crawford',
							'delaware',
							'fairfield',
							'fayette',
							'franklin',
							'gallia',
							'geauga',
							'greene',
							'guernsey',
							'hamilton',
							'hardin',
							'harrison',
							'henry',
							'hocking',
							'huron',
							'jefferson',
							'lucas',
							'marion',
							'medina',
							'montgomery',
							'noble',
							'ottawa',
							'richland',
							'ross',
							'stark',
							'summit',
							'trumbull',
							'vinton',
							'warren',
							'washington',
							'wood',
							'wyandot'];
const COUNTY_MAP = {
	'ashland' : 'allen',
	'belmont' : 'allen',
	'carroll' : 'brown',
	'columbiana' : 'allen',
	'darke' : 'adams',
	'defiance' : 'adams',
	'erie' : 'auglaize',
	'fulton' : 'adams',
	'hancock' : 'guernsey',
	'highland' : 'adams',
	'holmes' : 'adams',
	'jackson' : 'auglaize',
	'knox' : 'adams',
	'lake' : 'auglaize',
	'lawrence' : 'adams',
	'logan' : 'brown',
	'madison' : 'champaign',
	'mahoning' : 'allen',
	'meigs' : 'auglaize',
	'miami' : 'adams',
	'monroe' : 'crawford',
	'morgan' : 'brown',
	'morrow' : 'adams',
	'muskingum' : 'adams',
	'paulding' : 'adams',
	'perry' : 'guernsey',
	'pickaway' : 'auglaize',
	'pike' : 'henry',
	'portage' : 'adams',
	'preble' : 'auglaize',
	'putnam' : 'crawford',
	'sandusky' : 'adams',
	'scioto' : 'allen',
	'seneca' : 'auglaize',
	'tuscarawas' : 'brown',
	'union' : 'henry',
	'van wert' : 'crawford',
	'wayne' : 'adams',
	'williams' : 'adams',
	'wyandot' : 'crawford'

};
const SCRAPER_MAP = {};

LAYOUT_COUNTY_LIST.forEach((county) => {
	SCRAPER_MAP[county] = require('./counties/'+county+'/Scraper.js');
});

const TARGET_COUNTIES = 'warren'; // all, some, between, or county name;
const TARGET_COUNTY_LIST = ['clermont', 'coshocton']; // list of counties if above is 'some'. start and end counties if above is 'between'
const EXCLUDED_COUNTY_LIST = []; // to exclude any counties

/*
completed_counties = ['adams',
						'allen',
						'ashland',
						'ashtabula',
						'athens',
						'auglaize',
						'belmont',
						'butler',
						'champaign',
						'clermont',
						'clinton',
						'columbiana',
						'coshocton',
						'darke',
						'defiance',
						'delaware',
						'erie',
						'fairfield',
						'fayette',
						'franklin',
						'fulton',
						'gallia',
						'guernsey',
						'hancock',
						'highland',
						'hocking'];

*/

async function run(infilepath, headless){
	const CONFIG = new ConfigReader('delaware');
	let remainingInfo, finalpath, lastErroredParcel = '', numLastLinkErrors = 1;
	headless = (headless === 'true');
	while(true){
		
		let returnStatus = await runCycle(infilepath, remainingInfo, finalpath, headless, numLastLinkErrors);
		if(numLastLinkErrors === CONFIG.DEV_CONFIG.MAX_LINK_ERRORS) numLastLinkErrors = 1;

		if(returnStatus.code === CONFIG.DEV_CONFIG.SUCCESS_CODE){
			
			// log success
			console.log('Success');
			console.log('Output file is: ' + returnStatus.finalpath);
			return returnStatus; 
		} else if(returnStatus.code === CONFIG.DEV_CONFIG.FILE_READ_ERROR_CODE){
			numLastLinkErrors++;
			if(numLastLinkErrors > CONFIG.DEV_CONFIG.MAX_LINK_ERRORS){
				console.log('Unable to read file. Aborting.');
				throw "File can't be read!";
				break;
			}
		} else {
			// console.log(JSON.stringify(returnStatus,null,2));	
			let erroredParcel = returnStatus.remaining_info[CONFIG.DEV_CONFIG.PARCEL_IDX];
			// If link causes error more than once

			if(erroredParcel === lastErroredParcel){
				numLastLinkErrors++;
				
			} else {
				numLastLinkErrors = 1;
			}
			lastErroredParcel = erroredParcel;
			remainingInfo = returnStatus.remaining_info;
			finalpath = returnStatus.finalpath;
			console.log('Failed. See above error. Trying again.');
		}
		// log error
		
	}
	
}
async function runCycle(infilepath, remainingInfo, finalpath, headless, numLastLinkErrors){
	const browser = await puppeteer.launch({headless: headless});
	const page = await browser.newPage();

	const CONFIG = new ConfigReader('delaware');
	
	let excel = new ExcelWriter(0, 0, 'delaware');
	let worksheetInformation;
	if(remainingInfo !== undefined) worksheetInformation = remainingInfo;
	else {
		// console.log("Here");
		try{
			worksheetInformation = await excel.readFile(infilepath);
			worksheetInformation = worksheetInformation.map(row => row.slice(1));
			worksheetInformation.shift();
		} catch(e){
			return {
				return_status: CONFIG.DEV_CONFIG.FILE_READ_ERROR_CODE,
				remaining_info: remainingInfo
			}
		}
	}
	// console.log(worksheetInformation);
	
	let updatedInformation = [];
	let lastCounty = worksheetInformation[0][CONFIG.DEV_CONFIG.COUNTY_IDX];
	for(let i = 1; i < worksheetInformation.length; i++){


		let currentRow = worksheetInformation[i];
		
		if(typeof currentRow[CONFIG.DEV_CONFIG.DATE_IDX] === "string" && currentRow[CONFIG.DEV_CONFIG.DATE_IDX].trim() !== ''){
			currentRow[CONFIG.DEV_CONFIG.DATE_IDX] = DateHandler.formatDate(new Date(currentRow[CONFIG.DEV_CONFIG.DATE_IDX]));	
		} else if(typeof currentRow[CONFIG.DEV_CONFIG.DATE_IDX] === "object"){
			currentRow[CONFIG.DEV_CONFIG.DATE_IDX] = DateHandler.formatDate(DateHandler.incrementDate(new Date(currentRow[CONFIG.DEV_CONFIG.DATE_IDX])));
		}

		let county = currentRow[CONFIG.DEV_CONFIG.COUNTY_IDX].toLowerCase().trim();

		// console.log(county);
		let skipThisParcel = false;
		if( (!LAYOUT_COUNTY_LIST.includes(county) && !(county in COUNTY_MAP)) || EXCLUDED_COUNTY_LIST.includes(county) ) skipThisParcel = true;
		if(TARGET_COUNTIES === 'all'){
			// do nothing more
		} else if(TARGET_COUNTIES === 'some'){
			if( !TARGET_COUNTY_LIST.includes(county) ) skipThisParcel = true;
		} else if(TARGET_COUNTIES === 'between'){

			if( !( (TARGET_COUNTY_LIST[0].localeCompare(county) <= 0) && (TARGET_COUNTY_LIST[1].localeCompare(county) >= 0) )) skipThisParcel = true;
		} else if(TARGET_COUNTIES !== county){

			skipThisParcel = true;
		}
		let scrapedRow, comparisonArray;
		if(skipThisParcel) {
			continue; // uncomment this for full report
			scrapedRow = currentRow;
			comparisonArray = Array(11).fill(1);
		}

		else{
		
			if(county in COUNTY_MAP) county = COUNTY_MAP[county];
			let currentScraperType = SCRAPER_MAP[county];
			let currentScraper = new currentScraperType();

			let propertyURL = currentRow[CONFIG.DEV_CONFIG.PROP_URL_IDX];
			let auditorURL = currentRow[CONFIG.DEV_CONFIG.AUDITOR_URL_IDX];

			let parcelNum = currentRow[CONFIG.DEV_CONFIG.PARCEL_IDX];


			if(typeof propertyURL !== "string"){
				if(typeof propertyURL !== "undefined") propertyURL = propertyURL.text;
				else propertyURL = undefined;
			}
			currentRow[CONFIG.DEV_CONFIG.PROP_URL_IDX] = propertyURL;

			if(typeof auditorURL !== "string"){
				if(typeof auditorURL !== "undefined") auditorURL = auditorURL.text;
				else auditorURL = undefined;
			}

			currentRow[CONFIG.DEV_CONFIG.AUDITOR_URL_IDX] = auditorURL;
			
			let scrapedInformation = {};
			if(numLastLinkErrors === CONFIG.DEV_CONFIG.MAX_LINK_ERRORS){
				console.log(parcelNum + ' caused error more than ' + CONFIG.DEV_CONFIG.MAX_LINK_ERRORS + ' times. Skipping.')
				scrapedInformation.scraped_information = [parcelNum].concat(Array(10).fill('ERR'));
				scrapedInformation.scraped_information[CONFIG.DEV_CONFIG.COUNTY_IDX] = undefined;
			}
			else {
				scrapedInformation = await currentScraper.scrapeByPropertyURL(page, propertyURL);
				if(scrapedInformation.return_status == CONFIG.DEV_CONFIG.PAGE_ACCESS_ERROR_CODE){
					console.log('Property URL Invalid. Attempting to access via Parcel Number')
					scrapedInformation = await currentScraper.scrapeByAuditorURL(page, auditorURL, ""+parcelNum, browser);
					// console.log(scrapedInformation);
					// console.log(scrapedInformation.return_status);
					if(scrapedInformation.return_status == CONFIG.DEV_CONFIG.PAGE_ACCESS_ERROR_CODE){
						// Process some fatal error.
						console.log('Auditor URL Invalid. Aborting.')
						if(updatedInformation.length > 0){
							finalpath = await excel.writeToFile(CONFIG.USER_CONFIG.TARGET_DIR, updatedInformation, finalpath);	
						}
						await browser.close();
				
						return {
							return_status: scrapedInformation.return_status,
							remaining_info: worksheetInformation.slice(i),
							finalpath: finalpath
						}
						
					}
				}
			}

			comparisonArray = [];
			scrapedRow = scrapedInformation.scraped_information;
			for(let i = 0; i < currentRow.length; i++){
				
				// console.log(currentRow[i]);
				// console.log(scrapedRow[i]);
				// console.log((''+currentRow[i]).charCodeAt(0));
				// console.log((''+scrapedRow[i]).charCodeAt(0));
				// console.log(' x ');

				if(currentRow[i] !== undefined) currentRow[i] = (''+currentRow[i]).replace(/\s\s+/g,'-').trim();
				else currentRow[i] = '';
				if(scrapedRow[i] === undefined) scrapedRow[i] = currentRow[i];
				// if(scrapedRow[i] !== undefined) scrapedRow[i] = (''+scrapedRow[i]).charCodeAt(21) + ' ' + (''+scrapedRow[i]).charCodeAt(22) + ' ' + (''+scrapedRow[i]).charCodeAt(23);
				if(scrapedRow[i] !== undefined) scrapedRow[i] = (''+scrapedRow[i]).replace(/[\u000A]|\s\s+/g,' ').trim();
				
				// console.log(currentRow[i]);
				// console.log(scrapedRow[i]);
				// console.log(currentRow[i].charCodeAt(0));
				// console.log(scrapedRow[i].charCodeAt(0));
				// console.log(' --- ');
				comparisonArray.push(currentRow[i] === scrapedRow[i]);
			}
			
			comparisonArray = comparisonArray.map(b => b ? 0 : 1);
		}
		// let changesFound = !comparisonArray.every(x => x);
		// if(changesFound) scrapedRow.push("YES");
		// else scrapedRow.push("NO");
		scrapedRow.push(comparisonArray.join(''));
		updatedInformation.push(scrapedRow);
	}
	
	finalpath = await excel.writeToFile(CONFIG.USER_CONFIG.TARGET_DIR, updatedInformation, finalpath);
	await browser.close();
	finalpath = excel.appendComplete(finalpath);
	return {
		code: CONFIG.DEV_CONFIG.SUCCESS_CODE,
		finalpath: finalpath
	};
	
}

run("C:\\Python37\\Programs\\MHPScraper\\Excel\\original.xlsx",false);
module.exports = run;
