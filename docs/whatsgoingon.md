# What's going on?

This document will highlight how the application does everything mentioned in root/README.md

<h3> DISCLAIMER: </h3> The focus of this project for the short time I was working on it was progress and results (as software engineers typically focus on) and not necessarily code maintenance (as software engineers tend to neglect.) You may encounter some (read: a lot) of janky code that perhaps could be better written, but what is already present seems to work as it stands. 

<h3>What and how:</h3>

<ol>
  <li> Take and read base Excel file as input to the program
    <ul>
      <li> Read path of input file from config file config/user_config.json </li>
      <li> This (and other config reading activities) is done in the module ConfigReader, conveniently placed in src/ConfigReader.js </li>
      <li> ConfigReader uses standard JavaScript JSON library. </li>
    </ul>
  </li>
  <li>
    Read the Excel File row-by-row for each property
    <ul>
      <li> Uses the NodeJS package <a href='https://github.com/exceljs/exceljs'>exceljs</a> </li>
      <li> Excel reading occurs in module ExcelWriter, located in src/ExcelWriter.js (sorry for the poor naming, this module does both Excel reading and writing) </li>
    </ul>
  </li>
  <li>
    Visit the property page using the hyperlink(s) provided in the Excel row for that property
    <ul>
      <li> This is the biggest bulk of the application which will take the most time to get through / write anew. </li>
      <li> Uses the NodeJS package <a href='https://github.com/puppeteer/puppeteer'>puppeteer</a> </li>
      <li> All web-scraping occurs in files src/[county_name]/Scraper.js, with each of these files being the scraper for the respective county. </li>
    </ul>
  </li>
  <li>
    Read relevant property information from the property page
    <ul>
      <li> Also using puppeteer </li>
    </ul>
  </li>
  <li>
    Compare read information with information present in Excel sheet already. Mark any changes in information.
    <ul>
      <li> Simple equality relations of Strings of text. </li>
      <li> Write a string of 1s and 0s to extra column in extra sheet. n-th digit contains 0 if n-th column hasn't changed, 1 otherwise </li>
    </ul>
  </li>
  <li>
    Output new information and comparison results to new Excel file.
    <ul>
      <li> Changes in Excel sheet highlighted using Excel VBA Macros diff.xlam and cleardiff.xlam in src/macros/ </li>
    </ul>
  </li>
</ol>
