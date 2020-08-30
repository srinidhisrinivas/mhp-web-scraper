const Excel = require('exceljs');
const ConfigReader = require('./ConfigReader.js');
const ERROR_LOGGER = require("./ErrorLogger.js");

let ExcelWriter = function(start, end, county){
	const CONFIG = new ConfigReader(county);
	this.startDate = start;
	this.endDate = end;
	this.county = county;
	this.writeToFile = async (filepath, information, finalpath) => {

		console.log(finalpath);
		const SHEET_NAME = 'Audit';
		let workbook = new Excel.Workbook();
		let sheet;
		if(finalpath === undefined){
			let currentDate = new Date();
			// let filename = 'Conveyances'+ '_' 
			// 			+ currentDate.getFullYear() + '_'
			// 			+ (currentDate.getMonth() < 9 ? '0' : '') + (currentDate.getMonth() + 1) + '_'
			// 			+ (currentDate.getDate() < 10 ? '0' : '') + currentDate.getDate() + '_'
			// 			+ (currentDate.getHours() < 10 ? '0' : '') + currentDate.getHours() + '_'
			// 			+ (currentDate.getMinutes() < 10 ? '0' : '') + currentDate.getMinutes() + '.xlsx';
			let filename = 'Audit' + '_' 
						+ currentDate.getFullYear()
						+ (currentDate.getMonth() < 9 ? '0' : '') + (currentDate.getMonth() + 1)
						+ (currentDate.getDate() < 10 ? '0' : '') + currentDate.getDate()
						+ '.xlsx';

			finalpath = filepath + '\\' + filename;
			sheet = workbook.addWorksheet(SHEET_NAME);
			sheet.columns = [
				{header: 'Parcel Numbers', key: 'parcel', style:{font: {name:'Calibri', size: 11}}},
				{header: 'Last Sale Date', key: 'date', style:{font: {name:'Calibri', size: 11}}},
				{header: 'Last Sale Price', key: 'price', style:{font: {name:'Calibri', size: 11}}},
				{header: 'Primary Contact: Company Name: Company Name', key: 'company', style:{font: {name:'Calibri', size: 11}}},
				{header: 'Property: Company Name Per The Auditor', key: 'name', style:{font: {name:'Calibri', size: 11}}},
				{header: 'Property: Company Address Per Auditor', key: 'address', style:{font: {name:'Calibri', size: 11}}},
				{header: 'Mailing Tax Name', key: 'taxname', style:{font: {name:'Calibri', size: 11}}},
				{header: 'Mailing Tax Address', key: 'taxaddress', style:{font: {name:'Calibri', size: 11}}},
				{header: 'County', key: 'county', style:{font: {name:'Calibri', size: 11}}},
				{header: 'Direct Link to Property/Auditor', key: 'propertyURL', style:{font: {name:'Calibri', size: 11}}},
				{header: 'Link to Auditors Website', key: 'auditorURL', style:{font: {name:'Calibri', size: 11}}},
				{header: 'Changes Found', key: 'changes', style:{font: {name:'Calibri', size: 11}}}
			

			];
			
		} else {
			await workbook.xlsx.readFile(finalpath);
			sheet = workbook.getWorksheet(SHEET_NAME);
		}
		
		
		for(let i = 0; i < information.length; i++){
			let row = information[i];
			row = row.map(info => { if(info === undefined) return ""; else return info; });
			/*
			sheet.addRow({
				owner: conveyance.owner,
				street: conveyance.street,
				city: conveyance.city,
				state: conveyance.state,
				zip: conveyance.zip,
				transfer: conveyance.transfer,
				value: conveyance.value
			});
			*/
			let dataArray = row;
			sheet.addRow(dataArray);
		}

		await workbook.xlsx.writeFile(finalpath);

		return finalpath;
	}
	let appendToFileName = function(filepath, appendage){
		let fileparts = filepath.split('\\');
		let filename = fileparts.pop();
		let filedir = fileparts.join('\\');

		let nameparts = filename.split('.');
		let name = nameparts[0];
		let ext = nameparts[1];

		name = name + appendage;

		return filedir + '\\' + name + '.' + ext;
	}
	this.appendComplete = function(filepath){
		let newFilePath = appendToFileName(filepath, CONFIG.DEV_CONFIG.COMPLETE_APPEND);
		var fs = require('fs');
		fs.rename(filepath, newFilePath, function(err) {
		    if ( err ) console.log('ERROR: ' + err);
		});
		return newFilePath;
	}
	this.appendError = function(filepath){
		return appendToFileName(filepath, CONFIG.DEV_CONFIG.ERROR_APPEND);
	}

	this.readFile = async function(filepath){
		const workbook = new Excel.Workbook();
		await workbook.xlsx.readFile(filepath);
		let worksheet = workbook.worksheets[0];
		let worksheetArray = [];
		worksheet.eachRow(function(row, rowNumber){
			worksheetArray.push(row.values);
		});
		return worksheetArray
	}
}
module.exports = ExcelWriter;