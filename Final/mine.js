var map = [];
var dirt = [];

function getRandom(min, max) {
    return Math.floor(Math.random() * max) + min;
}

function set_mine() {
    map = [];
    for (let i = 0; i < 12; i++) {
        for (let j = 0; j < 12; j++) {
            map[i * 12 + j] = 0;
            dirt[i * 12 + j] = 0;
        }
    }
    var mine_total = 10; //getRandom(10, 20);
    for (let i = 0; i < mine_total; i++) {
        var x, y;
        do {
            x = getRandom(0, 11);
            y = getRandom(0, 11);
        } while (map[x * 12 + y] == 100);
        map[x * 12 + y] = 100;
    }
    var diri = [-1, 0, 1, -1, 1, -1, 0, 1];
    var dirj = [-1, -1, -1, 0, 0, 1, 1, 1];
    for (let i = 0; i < 12; i++) {
        for (let j = 0; j < 12; j++) {
            if (map[i * 12 + j] == 100) {
                continue;
            }
            for (let k = 0; k < 8; k++) {
                if (i + diri[k] < 0 || i + diri[k] > 11 || j + dirj[k] < 0 || j + dirj[k] > 11) {
                    continue;
                }
                if (map[(i + diri[k]) * 12 + (j + dirj[k])] == 100) {
                    map[i * 12 + j]++;
                }
            }
        }
    }
    console.log(map);
    //return map;
}

function open_dirt(x, y) {
    console.log("open: " + x + "," + y);
    dirt[x * 12 + y] = 1;
    var queue = new Queue();
    //var diri = [0, -1, 1, 0];
    //var dirj = [-1, 0, 0, 1];
    var diri = [-1, 0, 1, -1, 1, -1, 0, 1];
    var dirj = [-1, -1, -1, 0, 0, 1, 1, 1];
    if (map[x * 12 + y] == 0) {
        queue.enqueue([x, y]);
    }
    while (queue.size() > 0) {
        var top = queue.front();
        queue.dequeue();
        x = top[0];
        y = top[1];
        for (let k = 0; k < 8; k++) {
            if (x + diri[k] < 0 || x + diri[k] > 11 || y + dirj[k] < 0 || y + dirj[k] > 11) {
                continue;
            }
            if (map[(x + diri[k]) * 12 + (y + dirj[k])] == 0 && dirt[(x + diri[k]) * 12 + (y + dirj[k])] != 1) {
                queue.enqueue([x + diri[k], y + dirj[k]]);
            }
            dirt[(x + diri[k]) * 12 + (y + dirj[k])] = 1;
        }
    }
}

class Queue {
    constructor() {
        this.list = [];
    }
    // 插入一個元素
    enqueue(ele) {
        this.list.push(ele);
    }
    // 從頭移除元素
    dequeue() {
        this.list.shift();
    }
    // 總共幾個
    size() {
        return this.list.length;
    }
    // 回傳最前面的 ele
    front() {
        return this.list[0];
    }
    // 清掉全部
    clear() {
        this.list = [];
    }
}
