# What's going on in src?


A lot. If you don't want to read through all of this and want to go through the code directly, skip to <a href='#what_next'> here </a>.

<hr>

To get the easy stuff out of the way, `macros` contains a couple of Excel VBA macros that are used to highlight and un-highlight information in the resultant Excel documents. These are not commented because I believe they are self-explanatory. I hope I'm not wrong.

Now, on to the rest of `src`...

<h3> Remaining Files and Folders: </h3>

<ul>
  <li>
    ConfigReader.js - <em> Contains the module `ConfigReader` that is used to read the config JSON files. </em>
  </li>
  <li>
    DateHandler.js - <em> Contains the module `DateHandler` which contains some possibly useful functions to manipulate JS dates. </em>
  </li>
  <li>
    ErrorLogger.js - <em> Contains the module `ErrorLogger` which can be used to log errors to log files. Note the use of 'can', because I don't believe I have actually used it in this project. Error-proofing is always a luxury in software engineering that no one (or at least not I) wants to spend the time doing. </em>
  </li>
  <li>
    ExcelWriter.js - <em> Contains the module `ExcelWriter` which is used to read and write from Excel files. Quite important.</em>
  </li>
  <li>
    InfoParser.js - <em> Contains the module `InfoParser` which currently is empty. It's not necessary for this project, but I didn't want to take out the `require` statement for this module from all of the files that contain it, so I have left it in so that the program runs without any hitches. </em>
  </li>
  <li>
    index.js - <em> The place where it all starts. Here is the main execution loop and calls to other `Scraper` modules for the counties. Here also is where the reading from/writing to Excel occurs, along with comparison of extracted data and error recovery. This file will be heavily commented. </em>
  </li>
  <li>
    counties/ - <em> The place where all of the web-scraping takes place. This folder contains a sub-folder with a `Scraper.js` file from which I had to collect information. More on counties below. I will comment one file from each of the categories of counties (explained below) </em>
  </li>
</ul>

<h3> Counties: </h3>

So... Ohio has 88 (!!!) counties. So theoretically, there should be 88 sub-folders with the file `Scraper.js` in the `counties/` folder. However, that is not the case. There are two reasons for this:

<ol>
  <li>
    I didn't write all of them because 3 websites were an absolute pain to work with, and I just never ended up getting to them before I had to stop working on the project.
  </li>
  <li>
    Some of the counties had their websites set up exactly the same, so I could use the same `Scraper` module from another county on this county without changing anything.
  </li>
</ol>

There are two levels of similarity between auditors' websites:

<ol>
  <li>
    The two websites are structurally the exact same, as described in (2) above. Here I used the exact same Scraper module from other counties to scrape information.
  </li>
  <li>
    The two websites are structurally mostly the same, with some changes in the format/arrangement of the information. Here I just copied over the file from another similar county and made the required changes, which were typically only a few lines. Yes, this means that these copied files have a lot of repeated code. No, this is not good coding practice. I would suggest you not do the same, but it's possible that you continue to do it for the exact reason that I did (it's easier than refactoring to write consistent, reusable code.)
  </li>
</ol>

<h3 id="county_list"> County List: </h3>

Now I won't let you figure out by yourself which counties are similar. I will share that information with you. The counties with similar websites were divided into numbered categories. The numbers are arbitrary. The categories are as follows (counties <strike>stricken through</strike> are ones that I did not complete; counties in <b> bold </b> are ones whose files I've commented through):

<hr> 

1 - <b>Adams</b>, Auglaize, Champaign, Clinton, Darke, Defiance, Erie, Fairfield, Fayette, Fulton, Gallia, Guernsey, Hancock, Highland, Hocking, Holmes, Huron, Jackson, Knox, Lake, Lawrence, Madison, Marion, Meigs, Miami, Morrow, Muskingum, Ottawa, Paulding, Perry, Pickaway, Portage, Preble, Ross, Sandusky, Seneca, Trumbull, Vinton, Washington, Wayne, Williams (41 counties)

2 - Allen, Ashland, Delaware, Belmont, Columbiana, Mahoning, Scioto (7 counties)

3 - Crawford, Hardin, Harrison, Monroe, Noble, Putnam, Van Wert, Wyandot (8 counties)

4 - Ashtabula, Athens, Butler, Clermont, Coshocton, Franklin, Montgomery, Stark (8 counties)

5 - Brown, Carroll, Logan, Morgan, Tuscarawas (5 counties)

6 - <b>Richland</b>, Wood (2 counties)

7 - Henry, Pike, Union (3 counties)

8 - <b>Clark</b>, Shelby (2 counties)

The following 12 counties are all dissimilar from each other and each of the counties listed above: <strike>Cuyahoga</strike>, Geauga, Greene, Hamilton, <b>Jefferson</b>, Licking, <strike>Lorain</strike>, Lucas, Medina, <strike>Mercer</strike>, Summit, Warren
<hr>

Of the counties that are similar, you can find out the counties that are <em> exactly </em> the same by referring to the variable `COUNTY_MAP` in `index.js`.

<h3 id='what_next'> What next? </h3>

Read the file `index.js` and the files of the counties in <b> bold </b> in the <a href="#county_list"> county list above. </a> (For example, Richland county would be located in `src/counties/richland/Scraper.js`.)  This should help you understand the bulk of the operation of the program.

<i>Hint:</i> To extend this for the state of Indiana, the websites in category 6 and 8 will probably be of most interest to you, based on the layouts of those websites. In fact, start looking at Richland county (category 6) first because that will have some extra information about web-scraping in general and how web-scraping is done in these modules. The functions in the scrapers of other counties serve the same purpose as the functions in Richland county, so I've only included function descriptions in the one for Richland county.
