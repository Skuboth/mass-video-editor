#!/usr/bin/env node

var fs = require('fs');
var createCsvWriter = require('csv-writer').createObjectCsvWriter;
var csv = require('csv-parser');
var ffmpeg = require('fluent-ffmpeg');
const { start } = require('repl');

var argv = require('yargs/yargs')(process.argv.slice(2))
    .usage('Usage: node-edit <command> [options]')
    .command('init', 'Setup video editting folder', () => {},
        (argv) => {
            buildFile(argv);
        })
    .command('edit', 'Use the Config.csv and trim all mp4s', () => {},
        (argv) => {
            trimVideos(argv);
        })
    .help('h')
    .alias('h', 'help')
    .demandCommand(1, "A Command must be selected")
    .argv;

function buildFile(argv) {
    console.log("Build DIR");
    console.log(process.cwd())
    let videos = []
    let files = fs.readdirSync(process.cwd())
    files.forEach((filename) => {
        if (filename.endsWith('.mp4')) {
            videos.push({
                name: filename,
                start: '',
                end: '',
                mergeflag: 'N'
            });
        }
    })

    console.log(videos);

    const csvWriter = createCsvWriter({
        path: process.cwd() + '/config.csv',
        header: [
            {id: 'name', title: 'File Name'},
            {id: 'start', title: 'Start Time'},
            {id: 'end', title: 'End Time'},
            {id: 'mergeflag', title: 'Merge Audio?'}
        ]
    })

    csvWriter.writeRecords(videos).then(() => console.log("Created!"))
}

async function trimVideos(argv) {
    if (fs.existsSync(process.cwd() + '/config.csv')) {
        let results = [];

        if (!fs.existsSync(process.cwd() + '/clips/'))
            fs.mkdirSync(process.cwd() + '/clips/')

        fs.createReadStream(process.cwd() + '/config.csv')
            .pipe(csv(['name', 'start', 'end', 'merge']))
            .on('data', (data) => {
                results.push(data)
            })
            .on('end', () => {
                let ffmpegArray = [];
                results.forEach((obj, i) => {
                    if (i == 0)
                        return;

                     ffmpegArray.push(createffmpegObject(obj));
                })

                let newffmpeg = ffmpegArray.shift();
                if (newffmpeg != undefined)
                    saveffmpeg(newffmpeg, ffmpegArray, );
            })
    } else {
        console.log("config.csv doesn't exist. Please run init first.")
    }
}

function displayProgress(progress, obj) {
    process.stdout.write(`\rProcessing ( ${obj.name} ):  ${progress.timemark}`);
}

function createffmpegObject(obj) {

    console.log(`${process.cwd()}/${obj.name}`);
    let startTime = obj.start.split(':').reduce((m,s)=> new Date(m*6e4 + s*1e3))
    let endTime = obj.end.split(':').reduce((m,s)=> new Date(m*6e4 + s*1e3))
    let duration = (endTime - startTime) / 1000;

    return ffmpeg(`${process.cwd()}/${obj.name}`)
        .on('start', function(commandLine) {
            console.log('Spawned Ffmpeg with command: ' + commandLine);
        })
        .on('progress', function(progress) {
            displayProgress(progress, obj)
        })
        .on('error', function(err, stdout, stderr) {
          console.log('Cannot process video: ' + err.message);
        })
        .seekInput(obj.start)
        .duration(duration)
        .outputOptions('-map 0')
        .output(`${process.cwd()}/clips/${obj.name}`);
}

function saveffmpeg(ffmpeg, ffmpegArray) {
    ffmpeg
    .on('end', function(stdout, stderr) {
        console.log("\nDone!");
        let newffmpeg = ffmpegArray.shift();
        if (newffmpeg != undefined)
            saveffmpeg(newffmpeg, ffmpegArray);
    })
    .run();
}