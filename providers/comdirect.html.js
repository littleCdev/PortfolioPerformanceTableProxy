
function getlist(){
    var isin = $("#isin").val();
    $.get( "/tables/comdirect/getnotation-id/"+isin, {"_": $.now() /* cache.. */})
        .done(function( data) {
            $("#list").html(data);
            initEvents();
        })
        .fail(function (data) {

        });
}

const copyToClipboard = str => {
    const el = document.createElement('textarea');
    el.value = str;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
};

function initEvents(){
    $("a.copyurl").on("click",function (e) {
        e.preventDefault();
        var url = $(this).attr("href");
        copyToClipboard(url);
    });
}

$(function() {
    $("#getUrls").one("click",function (e) {
        getlist();
    });

});