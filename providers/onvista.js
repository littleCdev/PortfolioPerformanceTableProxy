let express = require('express');
let router = express.Router();

let request = require('request');
let cfg     = require("../config.json");

let SEARCHURL = "https://www.onvista.de/fonds/%ISIN%"
let URL = "http://www.onvista.de/fonds/kurshistorie.html?ID_NOTATION=%NOTATIONID%&RANGE=36M";
let TABLE = "<table>\n" +
    "    <thead>\n" +
    "        <tr>\n" +
    "            <th>Datum</th>\n" +
    "            <th>Close</th>\n" +
    "            <th>Tageshoch</th>\n" +
    "            <th>Tagestief</th>\n" +
    "        </tr>\n" +
    "    </thead>\n" +
    "    <tbody>\n" +
    "        %BODY%\n" +
    "    </tbody>\n" +
    "</table>";

let ROW = "<tr>" +
    "<td>%DATE%</td>" +
    "<td>%PRICE%</td>" +
    "<td>%PRICE%</td>" +
    "<td>%PRICE%</td>" +
    "</tr>";

function getIdNotation(isin,callback) {
    let sUrl = SEARCHURL.replace(/%ISIN%/gi,isin);
    let req;
    if(cfg.proxy.useproxy){
        console.log("proxy");
        let proxyUrl = "http://" + cfg.proxy.user + ":" + cfg.proxy.password + "@" + cfg.proxy.host + ":" + cfg.proxy.port;
        req = request.defaults({'proxy': proxyUrl});
    }else {
        req = request;
    }
console.log(sUrl);
    req(sUrl, function (error, response, body) {
        console.log('error:', error); // Print the error if one occurred
        console.log('statusCode:', response && response.statusCode); // Print the response status code if a response was received

        if(response === undefined || response.statusCode !== 200){
            callback("ERROR no response");
            return;
        }
        let regex = /data-notation="(.+)"/gmi;
        let match = regex.exec(body);

        if(match == null || match[1] ===undefined){
            callback("ERROR no notation-id found");
            return;
        }

        let html = match[0];

        let notationId = html.replace("data-notation=","").replace(/"/gi,"");

        console.log(notationId);

        callback(null,notationId);
    });
}

function getDataFromTable(res,notationId) {

    let sUrl = URL.replace(/%NOTATIONID%/gi,notationId);
    let req;
    if(cfg.proxy.useproxy){
        let proxyUrl = "http://" + cfg.proxy.user + ":" + cfg.proxy.password + "@" + cfg.proxy.host + ":" + cfg.proxy.port;
        req = request.defaults({'proxy': proxyUrl});
    }else {
        req = request;
    }

    req(sUrl, function (error, response, body) {
        console.log('error:', error); // Print the error if one occurred
        console.log('statusCode:', response && response.statusCode); // Print the response status code if a response was received

        if(response.statusCode !== 200){
            res.send("ERROR");
            return;
        }

        let sTableBody = "";
        let sHtml = body;
        let regex = /<td>([0-9]{2}.[0-9]{2}.[0-9]{2})<\/td><td>([0-9]+,[0-9]+)<\/td>/gim;
        let match, results = [];
        while (match = regex.exec(sHtml)) {
            sTableBody += ROW.replace(/%DATE%/ig,match[1]).replace(/%PRICE%/ig,match[2]);
        }
        let table = TABLE.replace(/%BODY%/ig,sTableBody);

        res.send(table);

    });

}

router.get('/isin/:ISIN', function (req, res) {
    getIdNotation(req.params.ISIN,function (err,notationId) {
        if(err !== null){
            res.send("ERROR");
            return;
        }
        getDataFromTable(res,notationId);
    });
});


module.exports = router;