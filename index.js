var express = require('express');
var fs = require('fs');

var app = express();

app.get('/', function (req, res) {
    var sList = "use: /&lt;provider&gt;/isin/&lt;your isin&gt;<br>";

    fs.readdir("./providers/", function(err, items) {
        for (var i=0; i<items.length; i++) {
            sList += items[i].replace(".js","")+"<br>";
        }
        res.send(sList);
    });

});

app.get('/:SOURCE/isin/:ISIN', function (req, res) {
    try{
        var o = require("./providers/"+req.params.SOURCE+".js");
        o.getCreateTable(res,req.params.ISIN);
    }catch (er){
        console.log(er);
        res.send("ERROR");
    }
});

app.listen(3000, function () {
    console.log('Example app listening on port 3000!');
});

