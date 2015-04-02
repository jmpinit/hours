var fs = require('fs'),
    util = require('util'),
    exec = require('child_process').exec,
    jsonlint = require('jsonlint'),
    mustache = require('mustache'),
    _ = require('underscore');

// TODO spellcheck

if (process.argv.length != 3) {
    console.log("usage: node hours.js <time log filename>");
    process.exit(1);
}

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
    check(log.rate !== undefined, "no hourly rate defined");
    check(typeof(log.rate) == 'number', "rate must be a number");

    var parsed = {
        name: log.name,
        rate: log.rate,
        days: []
    };

    var days = log.days;

    var lastDate = new Date(days[0].date);
    var total = 0;

    for (var i = 0; i < days.length; i++) {
        var day = days[i];

        var date = new Date(day.date);

        if (date.getTime() != lastDate.getTime())
            check(date > lastDate, "days are out of order: " + JSON.stringify(day));
        lastDate = date;

        var parsedSessions = [];
        var dayTotal = 0;
        var dayTotalBreak = 0;

        for (var j = 0; j < day.sessions.length; j++) {
            var sesh = day.sessions[j];
            var start = new Date(day.date + " " + sesh.start);
            var end = new Date(day.date + " " + sesh.end);
            var less = sesh.less || 0;

            check(dateIsValid(start), "invalid start: " + JSON.stringify(sesh.start));
            check(dateIsValid(end), "invalid end: " + JSON.stringify(sesh.end));
            check(end > start, "end of session must be after start: " + JSON.stringify(sesh));
            check(sesh.description.length > 0, "empty description: " + JSON.stringify(sesh));
            check(typeof(less) == 'number', "invalid 'less': " + JSON.stringify(sesh));

            parsedSessions.push({
                start: start,
                end: end,
                less: less,
                description: sesh.description
            });

            var workTime = millisToHours(end - start);
            var breakTime = less / 60;
            check(breakTime < workTime, "break time longer than session!: " + JSON.stringify(sesh));

            dayTotal += workTime - breakTime;
            dayTotalBreak += breakTime;
        }

        parsed.days.push({
            date: date,
            sessions: parsedSessions,
            total: dayTotal,
            break: dayTotalBreak,
            wasted: dayTotalBreak > 0
        });

        total += dayTotal;
    }

    parsed.total = total;
    parsed.earned = total * log.rate;

    return parsed;
}

function getHours(log) {
    return _.reduce(log.days, function(hours, day) {
        return hours + _.reduce(day.sessions, function(hours, sesh) {
            return hours + millisToHours(sesh.end - sesh.start);
        }, 0);
    }, 0);
}

function formatDate(date, start, end) {
    var full = date.toUTCString();
    return full.split(' ').slice(start, end).join(' ');
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

        view.period = util.format("%s to %s", formatDate(log.days[0].date, 1, 4), formatDate(log.days[log.days.length-1].date, 1, 4));

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
                return formatDate(new Date(render(text)), 0, 4);
            };
        }

        view.rounded = function() {
            return function (text, render) {
                return Number(render(text)).toFixed(2);
            };
        }

        var output = mustache.render(template, view);

        fs.writeFile("timesheet.html", output, function(err) {
            if (err) check(false, err.toString());

            exec('wkhtmltopdf timesheet.html timesheet.pdf', function (err, stdout, stderr) {
                if (err) check(false, err.toString());
                callback();
            });
        }); 
    });
}

var filename = process.argv[2];
var timelog = parseLog(jsonlint.parse(fs.readFileSync(filename, 'utf8')));

generatePDF(timelog, function(err) {
    if (err) check(false, err.toString());
    console.log("done");
});
