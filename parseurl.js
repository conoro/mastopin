// So from https://mastodon.social/@conoro to https://mastodon.social/users/conoro.atom

var url = "https://mastodon.social/@conoro";
var parsedUrl = require("url").parse(url);

var username;
console.log(parsedUrl.pathname);
console.log(parsedUrl.pathname.substr(-1));
if (parsedUrl.pathname.substr(-1) == "/") {
  username = parsedUrl.pathname.substr(2, parsedUrl.pathname.length - 3);
  console.log("1 ", username);
} else {
  username = parsedUrl.pathname.substr(2);
  console.log("2 ", username);
}
var rssURL =
  parsedUrl.protocol + "//" + parsedUrl.host + "/users/" + username + ".atom";

console.log(url);
console.log(rssURL);
