define(function () {
function ImageLoader() {
    var loadedFinished = null;
    this.loaded_images = 0;
    this.images = [];
    this.images_cache = {};
    var that = this;
    this.createImage = function (path) {
        if (!this.images_cache[path] !== undefined) {
        var image = new Image();
        image.addEventListener("load", function() {
            that.loaded_images++;
            if (that.loaded_images >= that.images.length) {
                loadedFinished();
            }
        });
        this.images.push([image, path]);
        this.images_cache[path] = image;
        return image;
        } else {
            return this.images_cache[path];
        }
    };

    this.createObjectImage = function (obj) {
        obj.img = this.createImage(obj.sprite);
    };

    this.loadImages = function (success) {
        loadedFinished = success;
        this.images.forEach(function(image) {
            image[0].src = "sprites/" + image[1];
        });
    };
}
var run = true;
var start = function (width, height, map, player, players) {
    var ctx = document.getElementById('canvas').getContext('2d');

    var il = new ImageLoader();

    map.forEach(function(tile) {
        il.createObjectImage(tile);
    });

    players.forEach(function(tile) {
        il.createObjectImage(tile);
    });

    il.createObjectImage(player);

    il.loadImages(function() {
        renderLoop();
    });

    var nx = function (x) {
        return x - player.x + width / 2;
    };

    var ny = function (y) {
        return y - player.y + height / 2;
    };

    var renderLoop = function () {
        ctx.clearRect(0,0, width, height);
        map.forEach(function(tile) {
            ctx.drawImage(tile.img, nx(tile.x), ny(tile.y));
        });

        players.forEach(function(remote_player) {
            ctx.drawImage(remote_player.img, nx(remote_player.x - remote_player.img.width / 2), ny(remote_player.y - remote_player.img.height / 2));
        });

        ctx.drawImage(player.img, width / 2 - player.img.width / 2, height / 2 - player.img.height / 2);
        if (run) {
            window.requestAnimationFrame(renderLoop);
        }
    };
};

var addSpritedObject = function (obj, success) {
    var il = new ImageLoader();
    il.createObjectImage(obj);
    il.loadImages(success);
};

return {
    start: start,
    stop: function() { run = false; },
    addSpritedObject :addSpritedObject
}
});