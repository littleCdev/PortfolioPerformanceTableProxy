let express     = require('express');
let router      = express.Router();

let request     = require('request');
let dateformat  = require('dateformat');
let papa        = require('papaparse');
let path        = require('path');
let cfg         = require("../config.json");

let SEARCHURL = "https://www.comdirect.de/inf/search/all.html?SEARCH_VALUE=%ISIN%";
let URLWITHMARKET = "https://www.comdirect.de/inf/%TYPE%/detail/uebersicht.html?SEARCH_REDIRECT=true&REFERER=search.general&REDIRECT_TYPE=ISIN&SEARCH_VALUE=%ISIN%&ID_NOTATION=%NOTATIONID%";
let URL = "https://kunde.comdirect.de/inf/kursdaten/historic.csv?INTERVALL=16&DATETIME_TZ_END_RANGE_FORMATED=%DATE%&WITH_EARNINGS=false&DATETIME_TZ_START_RANGE_FORMATED=01.01.1970&ID_NOTATION=%NOTATIONID%";

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
    "<td>%CLOSE%</td>" +
    "<td>%HIGH%</td>" +
    "<td>%LOW%</td>" +
    "</tr>";

let COLLECTION_ITEM = "<li class=\"collection-item avatar\">\n" +
    "      <span class=\"title\">%MARKET%</span>\n" +
    "      <p>%URL%<br>\n" +
    "      </p>\n" +
    " <a href=\"%URL%\" class=\"secondary-content copyurl\"><i class=\"material-icons\" title='copy link to clipboard'>file_copy</i></a>" +
    "    </li>";

function getIsinData(isin,callback) {
    let IsinData = {
        isin:"",
        type: "",
        isPercent:false,
        default_notation_id:-1,
        markets : {},
        currentData: {
            date: "0",
            price: -1
        }
    };

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
    req.get(sUrl, function (error, response, body) {
        console.log('error:', error); // Print the error if one occurred
        console.log('statusCode:', response && response.statusCode); // Print the response status code if a response was received
        console.log("response",response.request.uri.path);

        if(response === undefined || response.statusCode !== 200){
            callback("ERROR invalid response");
            return;
        }

        IsinData.isin = isin;

        // parse type (etfs,anleihen,aktien etc)
        let regex = /inf\/(.+)\/detail/gmi;
        let match = regex.exec(response.request.uri.path);
        if(match === null || match[1] === undefined){
            callback("ERROR: can not find isin type");
            return;
        }
        IsinData.type = match[1];
        console.log("1 -IsinData.type : "+IsinData.type );


        regex = /ID_NOTATION=([0-9]{1,})/gmi;
        match = regex.exec(response.request.uri.path);

        if(match === null || match[1] === undefined){
	    console.log("failed to get notation-id");
            callback("ERROR");
            return;
        }
        IsinData.default_notation_id = match[1];
        console.log("IsinData.default_notation_id : "+IsinData.default_notation_id );

        // get current price and date, will be added to csv values in case market isn't closed yet
        regex = /<td class="table__column--top table__column--right" data-label="Datum">([0-9]{2}.[0-9]{2}.[0-9]{2})<\/td>/gmi;
        match = regex.exec(body);
        if(match == null || match[1] ===undefined){
            console.log("marked seems to be closed");
            // value of regex above is "---" if marked is closed -> second try
            regex = /<td class="table__column--right" data-label="Datum">([0-9]{2}.[0-9]{2}.[0-9]{2})<\/td>/gmi;
            match = regex.exec(body);

            if(match == null || match[1] ===undefined) {
                callback("ERROR can not get date");
                return;
            }
        }
        IsinData.currentData.date = match[1];
        IsinData.currentData.date = IsinData.currentData.date.substr(0,6)+dateformat(new Date(),"yyyy");
        console.log("IsinData.currentData.date: "+IsinData.currentData.date);


        // check if is % or actual price
        regex = /<span class="text-size--medium outer-spacing--small-top">(.+)<\/span>/gmi;
        match = regex.exec(body);

        if(match == null || match[1] ===undefined){
            callback("getIsinData: ERROR can not check if percent or not");
            return;
        }

        if(match[1] === "%") {
            IsinData.isPercent = true;
            console.log("is percent");
        }


        // two tries...

        regex = /<span class="realtime-indicator--value text-size--xxlarge text-weight--medium">([\s ]+)?([0-9\.]+,[0-9]+)([\s ]+)?<\/span>/gmi;

        match = regex.exec(body);
        if(match == null || match[2] ===undefined){
            regex = /<span class="text-size--xxlarge text-weight--medium">([\s ]+)?([0-9\.]+,[0-9]+)([\s ]+)?<\/span>/gmi;

            match = regex.exec(body);
            if(match == null || match[2] ===undefined) {
                callback("ERROR can not get current price");
                return;
            }
        }
        IsinData.currentData.price = match[2];
        console.log("IsinData.currentData.price: "+IsinData.currentData.price);

        callback(null,IsinData);
    });
}

function getIsinDataWithMarket(IsinData,callback) {

    let sUrl = URLWITHMARKET
        .replace(/%NOTATIONID%/gi,IsinData.default_notation_id)
        .replace(/%ISIN%/gi,IsinData.isin)
        .replace(/%TYPE%/gi,IsinData.type);
    let req;
    if(cfg.proxy.useproxy){
        console.log("proxy");
        let proxyUrl = "http://" + cfg.proxy.user + ":" + cfg.proxy.password + "@" + cfg.proxy.host + ":" + cfg.proxy.port;
        req = request.defaults({'proxy': proxyUrl});
    }else {
        req = request;
    }
    console.log(sUrl);
    req.get(sUrl, function (error, response, body) {
        console.log('error:', error); // Print the error if one occurred
        console.log('statusCode:', response && response.statusCode); // Print the response status code if a response was received
        console.log("response",response.request.uri.path);

        if(response === undefined || response.statusCode !== 200){
            callback("ERROR invalid response");
            return;
        }

        // parse type (etfs,anleihen,aktien etc)
        let regex = /inf\/(.+)\/detail/gmi;
        let match = regex.exec(response.request.uri.path);
        if(match === null || match[1] === undefined){
            callback("ERROR: can not find isin type");
            return;
        }
        IsinData.type = match[1];
        console.log("2 -IsinData.type : "+IsinData.type );


        regex = /ID_NOTATION=([0-9]{1,})/gmi;
        match = regex.exec(response.request.uri.path);

        if(match === null || match[1] === undefined){
	    console.log("failed to get isin2");
            callback("ERROR");
            return;
        }
        IsinData.default_notation_id = match[1];
        console.log("IsinData.default_notation_id : "+IsinData.default_notation_id );

        // get current price and date, will be added to csv values in case market isn't closed yet
        regex = /<td class="table__column--top table__column--right" data-label="Datum">([0-9]{2}.[0-9]{2}.[0-9]{2})<\/td>/gmi;
        match = regex.exec(body);
        if(match == null || match[1] ===undefined){
            console.log("marked seems to be closed");
            // value of regex above is "---" if marked is closed -> second try
            regex = /<td class="table__column--right" data-label="Datum">([0-9]{2}.[0-9]{2}.[0-9]{2})<\/td>/gmi;
            match = regex.exec(body);

            if(match == null || match[1] ===undefined) {
                callback("ERROR can not get date");
                return;
            }
        }

        IsinData.currentData.date = match[1];
        IsinData.currentData.date = IsinData.currentData.date.substr(0,6)+dateformat(new Date(),"yyyy");
        console.log("IsinData.currentData.date: "+IsinData.currentData.date);


        // check if is % or actual price
        regex = /<span class="text-size--medium outer-spacing--small-top">(.+)<\/span>/gmi;
        match = regex.exec(body);

        if(match == null || match[1] ===undefined){
            callback("getIsinDataWithMarket: ERROR can not check if percent or not");
            return;
        }

        if(match[1] === "%") {
            IsinData.isPercent = true;
            console.log("is percent");
        }

        // two tries...

        regex = /<span class="realtime-indicator--value text-size--xxlarge text-weight--medium">([\s ]+)?([0-9\.]+,[0-9]+)([\s ]+)?<\/span>/gmi;

        match = regex.exec(body);
        if(match == null || match[2] ===undefined){
            regex = /<span class="text-size--xxlarge text-weight--medium">([\s ]+)?([0-9\.]+,[0-9]+)([\s ]+)?<\/span>/gmi;

            match = regex.exec(body);
            if(match == null || match[2] ===undefined) {
                callback("ERROR can not get current price");
                return;
            }
        }
        IsinData.currentData.price = match[2];
        console.log("IsinData.currentData.price: "+IsinData.currentData.price);

        callback(null,IsinData);
    });
}

function getDataFromTable(res,IsinData) {
    let sToday = dateformat(new Date(),"dd.mm.yyyy");
    let sUrl = URL.replace(/%NOTATIONID%/gi,IsinData.default_notation_id).replace(/%DATE%/gi,sToday)
    console.log(sUrl);

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
            res.send("ERROR invalid response");
            return;
        }


        let oCSV = papa.parse(body,{
            skipEmptyLines:true
        });

        oCSV.data.splice(0,2); //removes headers
        /*
        0->Datum
        1->Eröffnung
        2->Hoch
        3->Tief
        4->Schluss
        5->Volumen
         */
        let sTableBody = "";
        let bCurrentDataFound = false;
 //       console.log(oCSV);
        for(let i=0; i<oCSV.data.length;i++){
            if(oCSV.data[i][0] === IsinData.currentData.date){
                console.log("Date found!");
                bCurrentDataFound = true;
            }

            if(IsinData.isPercent){
                oCSV.data[i][2] = parseFloat(oCSV.data[i][2])/100;
                oCSV.data[i][3] = parseFloat(oCSV.data[i][3])/100;
                oCSV.data[i][4] = parseFloat(oCSV.data[i][4])/100;
            }

            sTableBody += ROW
                .replace(/%DATE%/ig,oCSV.data[i][0])
                .replace(/%HIGH%/ig,oCSV.data[i][2])
                .replace(/%LOW%/ig,oCSV.data[i][3])
                .replace(/%CLOSE%/ig,oCSV.data[i][4]);
        }


        if(!bCurrentDataFound && IsinData.currentData.date !== "0"){

            if(IsinData.isPercent)
                IsinData.currentData.price = parseFloat(IsinData.currentData.price)/100;

            sTableBody = ROW
                .replace(/%DATE%/ig,IsinData.currentData.date)
                .replace(/%HIGH%/ig,IsinData.currentData.price)
                .replace(/%LOW%/ig,IsinData.currentData.price)
                .replace(/%CLOSE%/ig,IsinData.currentData.price)
            +sTableBody;
        }

        let table = TABLE.replace(/%BODY%/ig,sTableBody);

        res.send(table);
    });

}


router.get('/getnotation-id/:ISIN',function (req,res) {

    let isin = req.params.ISIN;

    let sUrl = SEARCHURL.replace(/%ISIN%/gi,isin);
    let xhrreq;
    if(cfg.proxy.useproxy){
        console.log("proxy");
        let proxyUrl = "http://" + cfg.proxy.user + ":" + cfg.proxy.password + "@" + cfg.proxy.host + ":" + cfg.proxy.port;
        xhrreq = request.defaults({'proxy': proxyUrl});
    }else {
        xhrreq = request;
    }
console.log(sUrl);

    xhrreq.get(sUrl, function (error, response, body) {
        console.log('error:', error); // Print the error if one occurred
        console.log('statusCode:', response && response.statusCode); // Print the response status code if a response was received

        if(response === undefined || response.statusCode !== 200){
            callback("ERROR");
            return;
        }

        let regex = /<option value=\"([0-9]{1,})\"([ ]+selected=\"selected\")?[ ]+label=\"(.+)\">(.+)<\/option/gmi;

        let match;
        let list = "";
        let url = "http://"+req.get('host')+"/tables/comdirect/notationid/";
        while ((match = regex.exec(body)) != null) {
            console.log(match[1]+"\t"+match[3]);
            list += COLLECTION_ITEM
                .replace(/%MARKET%/gmi,match[3])
                .replace(/%URL%/gmi,url+match[1]+"/isin/"+isin);
        }

        res.send(list);

    });
});

router.get('/notationid/:NOTATIONID/isin/:ISIN', function (req, res) {
    // sadly need to call getIsinData first because the second request needs the type of the isin
    // third is to get the csv data
    getIsinData(req.params.ISIN,function (err,data) {
        if(err !== null){
            res.send(err);
            return;
        }

        data.default_notation_id = req.params.NOTATIONID;
        console.log("Overrideing default_notation_id with: "+req.params.NOTATIONID);
        getIsinDataWithMarket(data,function (err,data) {
            if(err !== null){
                res.send(err);
                return;
            }
            getDataFromTable(res,data);
        })
    });

});

router.get('/isin/:ISIN', function (req, res) {
    getIsinData(req.params.ISIN,function (err,data) {
        if(err !== null){
            res.send(err);
            return;
        }
        getDataFromTable(res,data);
    })

});

router.get('/', function (req, res) {
    res.sendFile("comdirect.html", { root: path.join(__dirname, '') });
});

router.get('/comdirect.html.js', function (req, res) {
    res.sendFile("comdirect.html.js", { root: path.join(__dirname, '') });
});


module.exports = router;
