# What's in config?

This folder contains two files, `dev_config.json` and `user_config.json`. `user_config_original.json` is only a backup of the latter file.

`dev_config.json` contains some defined timeout values, ID values, and so on that are used throughout the program to avoid having to change numbers everywhere. You will see where these are used when you read the code.

`user_config.json` contains the user's preferences, namely the Input file name (`SOURCE_FILE`), the Output file folder (`TARGET_DIR`), and the `RUN_TYPE`. It also contains default values for each of these fields in case the user wants to restore settings to default.

`RUN_TYPE` can take on three values:

<ol>
  <li>
    "all" - Runs for all counties. This is the default value. Fields `BETW_1`, `BETW_2`, and `ONE` should be empty.
  </li>
  <li>
    "between" - Runs for counties alphabetically between `BETW_1` and `BETW_2`. These should not be left empty if `RUN_TYPE` = "between"
  </li>
  <li>
    "one" - Runs for just one county, which is present in field `ONE`. `ONE` should not be left empty if `RUN_TYPE` = "one"
  </li>
</ol>

<h3> Editing User Configurations </h3>

User edits these settings using the batch file `EDIT_CONFIG.bat`. Go ahead and open it and see what it does.

`EDIT_CONFIG.bat` is an "HTA Application", which in essence is a HTML + JavaScript interface that runs in a Windows dialog box. If you read the code, you should be familiar with all of it if you're familiar with HTML and JS. What is new is the ability to edit JSON files, namely `user_config.json` using Chilkat JSON Objects as part of the Chilkat ActiveX Objects (link to download and documentation in `docs/whatsgoingon.md`)

I have not commented this file because I believe it's quite self-explanatory. It's just a bunch of input fields with HTML, field validation with JS, and updating JSON files also with JS.

