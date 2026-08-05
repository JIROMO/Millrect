(function () {
  "use strict";

  var SITE = "https://millrect.com";
  var OGP_IMAGE = SITE + "/site/images/ogp.jpg?v=20260805";
  var pathname = window.location.pathname || "";
  if (!pathname || pathname === "/") return;

  var canonical = SITE + pathname;

  if (!document.querySelector('link[rel="canonical"]')) {
    var link = document.createElement("link");
    link.rel = "canonical";
    link.href = canonical;
    document.head.appendChild(link);
  }

  if (!document.querySelector('meta[property="og:url"]')) {
    var ogUrl = document.createElement("meta");
    ogUrl.setAttribute("property", "og:url");
    ogUrl.content = canonical;
    document.head.appendChild(ogUrl);
  }

  if (!document.querySelector('meta[property="og:image"]')) {
    var ogImage = document.createElement("meta");
    ogImage.setAttribute("property", "og:image");
    ogImage.content = OGP_IMAGE;
    document.head.appendChild(ogImage);
  }

  if (!document.querySelector('meta[name="twitter:card"]')) {
    var twitterCard = document.createElement("meta");
    twitterCard.name = "twitter:card";
    twitterCard.content = "summary_large_image";
    document.head.appendChild(twitterCard);
  }

  if (!document.querySelector('meta[name="twitter:image"]')) {
    var twitterImage = document.createElement("meta");
    twitterImage.name = "twitter:image";
    twitterImage.content = OGP_IMAGE;
    document.head.appendChild(twitterImage);
  }
})();
