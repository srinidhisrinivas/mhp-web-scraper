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
							'guernsey',
							'hamilton',
							'hardin',
							'harrison',
							'henry',
							'hocking',
							'huron',
							'lucas',
							'marion',
							'montgomery',
							'noble',
							'ottawa',
							'richland',
							'ross',
							'stark',
							'summit',
							'trumbull',
							'vinton',
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
})

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


async function run(start, end, county){
	const browser = await puppeteer.launch({headless: false});
	const page = await browser.newPage();

	const CONFIG = new ConfigReader(county);
	let excel = new ExcelWriter(start,end, county);
	let worksheetInformation = await excel.readFile(CONFIG.USER_CONFIG.SOURCE_FILE);
	
	let updatedInformation = [];
	let filepath = 'C:\\Python37\\Programs\\MHPScraper\\Excel\\Audit_20200821.xlsx';
	let lastCounty = 'adams';
	for(let i = 1; i < worksheetInformation.length; i++){

		let currentRow = worksheetInformation[i].slice(1);
		// console.log(currentRow[CONFIG.DEV_CONFIG.DATE_IDX]);
		// console.log(typeof currentRow[CONFIG.DEV_CONFIG.DATE_IDX]);
		if(typeof currentRow[CONFIG.DEV_CONFIG.DATE_IDX] === "string" && currentRow[CONFIG.DEV_CONFIG.DATE_IDX].trim() !== ''){
			currentRow[CONFIG.DEV_CONFIG.DATE_IDX] = DateHandler.formatDate(new Date(currentRow[CONFIG.DEV_CONFIG.DATE_IDX]));	
		} else if(typeof currentRow[CONFIG.DEV_CONFIG.DATE_IDX] === "object"){
			currentRow[CONFIG.DEV_CONFIG.DATE_IDX] = DateHandler.formatDate(DateHandler.incrementDate(new Date(currentRow[CONFIG.DEV_CONFIG.DATE_IDX])));
		}

		let county = currentRow[CONFIG.DEV_CONFIG.COUNTY_IDX].toLowerCase().trim();

		if(county === 'guernsey') break;
		
		if(!['geauga'].includes(county)) continue;
		
		// if( (!LAYOUT_COUNTY_LIST.includes(county) && !(county in COUNTY_MAP)) || completed_counties.includes(county)) continue;
		
		// if(county !== lastCounty){
		// 	console.log(filepath);
		// 	filepath = await excel.writeToFile(CONFIG.USER_CONFIG.TARGET_DIR, updatedInformation, filepath);
		// 	updatedInformation = [];
		// 	lastCounty = county;
		// }
		if(county in COUNTY_MAP) county = COUNTY_MAP[county];
		let currentScraperType = SCRAPER_MAP[county];
		let currentScraper = new currentScraperType();

		let propertyURL = currentRow[CONFIG.DEV_CONFIG.PROP_URL_IDX];
		let auditorURL = currentRow[CONFIG.DEV_CONFIG.AUDITOR_URL_IDX];

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
		
		// console.log(propertyURL);
		let scrapedInformation = await currentScraper.scrapeByPropertyURL(page, propertyURL);
		if(scrapedInformation.return_status == CONFIG.DEV_CONFIG.PAGE_ACCESS_ERROR_CODE){
			console.log('Property URL Invalid. Attempting to access via Parcel Number')
			let parcelNum = currentRow[CONFIG.DEV_CONFIG.PARCEL_IDX];
			scrapedInformation = await currentScraper.scrapeByAuditorURL(page, auditorURL, ""+parcelNum);
			if(scrapedInformation.return_status == CONFIG.DEV_CONFIG.PAGE_ACCESS_ERROR_CODE){
				// Process some fatal error.
				console.log('Auditor URL Invalid. Skipping.')
				scrapedInformation.scraped_information = [parcelNum].concat(Array(10).fill('ERR'));
				scrapedInformation.scraped_information[CONFIG.DEV_CONFIG.COUNTY_IDX] = undefined;
			}
		}

		let comparisonArray = [];
		let scrapedRow = scrapedInformation.scraped_information;
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
		// let changesFound = !comparisonArray.every(x => x);
		// if(changesFound) scrapedRow.push("YES");
		// else scrapedRow.push("NO");
		scrapedRow.push(comparisonArray.join(''));
		updatedInformation.push(scrapedRow);
	}
	
	await excel.writeToFile(CONFIG.USER_CONFIG.TARGET_DIR, updatedInformation);
	piss();

	let remainingDates, remainingLinks, finalpath, lastErroredLink = '', numLastLinkErrors = 1;
	let runCycle = require('./counties/'+county+'/runCycle.js');
	while(true){
		let returnStatus = await runCycle(start, end, remainingLinks, remainingDates, finalpath);
		if(returnStatus.code === CONFIG.DEV_CONFIG.SUCCESS_CODE){
			
			// log success
			console.log('Success');
			return returnStatus; 
		}
		// log error
		console.log(JSON.stringify(returnStatus,null,2));
		remainingDates = returnStatus.remaining_dates;
		let erroredLink = returnStatus.remaining_links[0];
		// If link causes error more than once

		if(erroredLink === lastErroredLink){
			numLastLinkErrors++;
			if(numLastLinkErrors > CONFIG.DEV_CONFIG.MAX_LINK_ERRORS){
				console.log(erroredLink + ' caused error more than ' + CONFIG.DEV_CONFIG.MAX_LINK_ERRORS + ' time. Skipping.');
				returnStatus.remaining_links.shift();
				numLastLinkErrors = 1;
			}
		} else {
			numLastLinkErrors = 1;
		}
		lastErroredLink = erroredLink;
		remainingLinks = returnStatus.remaining_links;
		finalpath = returnStatus.finalpath;
		console.log('Failed. See above error. Trying again.');
	}
	
}

run(0,0,'delaware');
module.exports = run;
