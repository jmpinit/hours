var fs = require('fs'),
    util = require('util'),
    jsonlint = require('jsonlint'),
    mustache = require('mustache'),
    _ = require('underscore');

// TODO spellcheck

if (process.argv.length != 3) {
    console.log("usage: node hours.js <time log filename>");
    process.exit(1);
}

var rate = 50; // per hour

function check(condition, message) {
    if (condition == false) {
        console.log("ERROR!", message);
        process.exit(1);
    }
}

function dateIsValid(d) {
    if (Object.prototype.toString.call(d) === "[object Date]") {
        if (isNaN(d.getTime())) {
            return false;
        } else {
            return true;
        }
    } else {
        return false;
    }
}

function millisToHours(millis) {
    return (millis / 1000) / 60 / 60;
}

function parseLog(log) {
    var parsed = { days: [] };

    var days = log.days;

    var lastDate = new Date(days[0].date);

    for (var i = 0; i < days.length; i++) {
        var day = days[i];

        var date = new Date(day.date);

        if (date.getTime() != lastDate.getTime())
            check(date > lastDate, "days are out of order: " + JSON.stringify(day));
        lastDate = date;

        var parsedSessions = [];
        var total = 0;

        for (var j = 0; j < day.sessions.length; j++) {
            var sesh = day.sessions[j];
            var start = new Date(day.date + " " + sesh.start);
            var end = new Date(day.date + " " + sesh.end);

            check(dateIsValid(start), "invalid start: " + JSON.stringify(sesh.start));
            check(dateIsValid(end), "invalid end: " + JSON.stringify(sesh.end));
            check(end > start, "end of session must be after start: " + JSON.stringify(sesh));
            check(sesh.description.length > 0, "empty description: " + JSON.stringify(sesh));

            parsedSessions.push({
                start: start,
                end: end,
                description: sesh.description
            });

            total += millisToHours(end - start);
        }

        parsed.days.push({
            date: date,
            sessions: parsedSessions,
            total: total
        });
    }

    return parsed;
}

function getHours(log) {
    return _.reduce(log.days, function(hours, day) {
        return hours + _.reduce(day.sessions, function(hours, sesh) {
            return hours + millisToHours(sesh.end - sesh.start);
        }, 0);
    }, 0);
}

function generatePDF(log, callback) {
    fs.readFile('templates/timesheet.mustache', 'utf8', function (err, template) {
        if (err) check(false, err.toString());

        var view = JSON.parse(JSON.stringify(log));
        
        var monthNames =
        [   "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December" ];

        var months = _.uniq(_.map(log.days, function(day) {
            return monthNames[day.date.getMonth()];
        }));

        view.title = util.format("Timesheet for %s", months.join(', '));

        view.hour = function() {
            return function (text, render) {
                var d = new Date(render(text));
                var hour = '' + d.getHours();
                var min = '' + d.getMinutes();

                if (min.length == 1)
                    min = '0' + min;

                return hour + ":" + min;
            };
        }

        view.dateString = function() {
            return function (text, render) {
                return (new Date(render(text))).toDateString();
            };
        }

        view.rounded = function() {
            return function (text, render) {
                return Number(render(text)).toFixed(2);
            };
        }

        var output = mustache.render(template, view);
        console.log(output);
        callback();
    });
}

var filename = process.argv[2];
var timelog = parseLog(jsonlint.parse(fs.readFileSync(filename, 'utf8')));

generatePDF(timelog, function(err) {
    if (err) check(false, err.toString());
});
