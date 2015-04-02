hours
=====

This is the script that I use for generating my timesheets. Maybe you'll find it useful. But probably not because it does only what I need.


features
--------

* sanity checks on the data (ex: "is the JSON formatted correctly?", "does the work end after it begins?")
* uses a mustache template to compose the output, so the format is easily customized
* generates PDF output from HTML using wkhtmltopdf

usage
-----

Run `node hours.js time.json` to generate a __timesheet.pdf__ from the __time.json__ file.

format
------

    {
        "name": "Bob Bob",
        "rate": 10.50,
        "days": [
            {
                "date": "1/1/2015",
                "sessions": [
                    {
                        "start": "9:00 AM",
                        "end": "11:30 PM",
                        "less": 30,
                        "description": "Did some stuff."
                    }
            }
        ]
    }

### fields

* __name__: your name
* __rate__: your hourly rate
* __sessions__: time segments when you are working
* __start__: the time when you started working
* __end__: the time when you stopped working
* __less__: the number of minutes you wasted (for breaks)
* __description__: what you worked on
