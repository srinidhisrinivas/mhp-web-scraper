Before running: Make sure the source file is saved in .xlsx format and the rows are sorted in alphabetical order of the counties.

1) Open EDIT_CONFIG

2) Destination Folder: The folder to which the Excel file will be output once complete.
(Copy the path of the folder ('Location') by right-clicking on the a file within the folder and then select 'Properties')
Source File: The file from which the program reads the links and compares the information.
(Copy the path as above, then copy the file name and add the extension ('Type of file'))

3) Select which counties to run on. If running only select counties, type the full name of the county with no extra spaces in the beginning or end.

4) Click 'Save'

5) Double click 'Run Audit'

6) Wait for the program to exit.

7) In the destination folder, there should be an output file with the name as follows: Audit_yyyymmdd.
If the file doesn't have '_complete' at the end, then it means the program exited without completing because
of an error. Open the excel file to see which county it failed on, and run the program again for the 
remaining counties. (CAUTION: rename the file before running the program again if done on the same day. Otherwise the file will be overwritten)

8) Use the Excel Add-ins 'Diff' and 'ClearDiff' to highlight or erase the differences the application
found while running.