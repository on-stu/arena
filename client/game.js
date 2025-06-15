import * as PIXI from "https://cdn.jsdelivr.net/npm/pixi.js@7.3.2/+esm";
import { io } from "https://cdn.socket.io/4.7.5/socket.io.esm.min.js";

const socket = io("https://arena.minsupabase.com");

// Pixi 기본 설정
const app = new PIXI.Application({
  width: 800,
  height: 600,
  backgroundColor: 0x1d1d1d,
});
document.body.appendChild(app.view);

// 플레이어 캐릭터
const myPlayer = new PIXI.Graphics();
myPlayer.beginFill(0x00ff00);
myPlayer.drawRect(0, 0, 40, 40);
myPlayer.endFill();
myPlayer.x = 400;
myPlayer.y = 300;
app.stage.addChild(myPlayer);

// 상대 플레이어들 저장소
const otherPlayers = {};
const enemyBullets = [];

// 키 입력 처리
const keys = {};
window.addEventListener("keyup", (e) => (keys[e.code] = false));
window.addEventListener("keydown", (e) => {
  if (!keys[e.code]) {
    keys[e.code] = true;

    // Arrow keys로 발사
    if (e.code === "ArrowUp") shootBullet(0, -1);
    if (e.code === "ArrowDown") shootBullet(0, 1);
    if (e.code === "ArrowLeft") shootBullet(-1, 0);
    if (e.code === "ArrowRight") shootBullet(1, 0);
  }
});

// 매 프레임마다 위치 갱신
app.ticker.add(() => {
  const speed = 4;
  let moved = false;
  let newX = myPlayer.x;
  let newY = myPlayer.y;

  if (keys["KeyW"]) {
    newY -= speed;
    moved = true;
  }
  if (keys["KeyS"]) {
    newY += speed;
    moved = true;
  }
  if (keys["KeyA"]) {
    newX -= speed;
    moved = true;
  }
  if (keys["KeyD"]) {
    newX += speed;
    moved = true;
  }

  // 화면 경계 체크
  newX = Math.max(0, Math.min(newX, app.screen.width - 40));
  newY = Math.max(0, Math.min(newY, app.screen.height - 40));

  // 위치를 서버에 보냄
  if (moved) {
    myPlayer.x = newX;
    myPlayer.y = newY;
    socket.emit("move", { x: myPlayer.x, y: myPlayer.y });
  }

  // 내 총알 이동
  for (let i = myBullets.length - 1; i >= 0; i--) {
    const b = myBullets[i];
    b.x += b.vx;
    b.y += b.vy;
    if (
      b.x < -10 ||
      b.x > app.screen.width + 10 ||
      b.y < -10 ||
      b.y > app.screen.height + 10
    ) {
      app.stage.removeChild(b);
      myBullets.splice(i, 1);
    }
  }

  // 상대 총알 이동
  for (let i = enemyBullets.length - 1; i >= 0; i--) {
    const b = enemyBullets[i];
    b.x += b.vx;
    b.y += b.vy;
    if (
      b.x < -10 ||
      b.x > app.screen.width + 10 ||
      b.y < -10 ||
      b.y > app.screen.height + 10
    ) {
      app.stage.removeChild(b);
      enemyBullets.splice(i, 1);
    }
  }

  for (let i = myBullets.length - 1; i >= 0; i--) {
    const bullet = myBullets[i];
    for (const [id, enemy] of Object.entries(otherPlayers)) {
      if (rectsIntersect(bullet, enemy)) {
        socket.emit("hit", id); // 서버에 히트 전송
        app.stage.removeChild(bullet);
        myBullets.splice(i, 1);
        break;
      }
    }
  }

  updateHpBar();
});

socket.on("playerShot", ({ id, x, y, vx, vy }) => {
  const bullet = createBullet(x, y, 0xffaaaa);
  bullet.vx = vx;
  bullet.vy = vy;
  enemyBullets.push(bullet);
});
// 서버에서 다른 플레이어 초기 정보 받기
socket.on("currentPlayers", (players) => {
  for (const [id, pos] of Object.entries(players)) {
    if (id !== socket.id) {
      const p = createOtherPlayer(pos.x, pos.y);
      otherPlayers[id] = p;
    }
  }
});

socket.on("newPlayer", ({ id, x, y }) => {
  if (id !== socket.id && !otherPlayers[id]) {
    const p = createOtherPlayer(x, y);
    otherPlayers[id] = p;
  }
});

socket.on("playerMoved", (playerData) => {
  if (otherPlayers[playerData.id]) {
    otherPlayers[playerData.id].x = playerData.x;
    otherPlayers[playerData.id].y = playerData.y;
  }
});

socket.on("playerDisconnected", (id) => {
  if (otherPlayers[id]) {
    app.stage.removeChild(otherPlayers[id]);
    delete otherPlayers[id];
  }
});

// 상대 캐릭터 생성 함수
function createOtherPlayer(x, y) {
  const player = new PIXI.Graphics();
  player.beginFill(0xff0000);
  player.drawRect(0, 0, 40, 40);
  player.endFill();
  player.x = x;
  player.y = y;
  app.stage.addChild(player);
  return player;
}

function createBullet(x, y, color = 0xffffff) {
  const bullet = new PIXI.Graphics();
  bullet.beginFill(color);
  bullet.drawCircle(0, 0, 5);
  bullet.endFill();
  bullet.x = x;
  bullet.y = y;
  app.stage.addChild(bullet);
  return bullet;
}

const myBullets = [];
const bulletSpeed = 6;

function shootBullet(dx, dy) {
  if (dx === 0 && dy === 0) return;
  const bullet = createBullet(myPlayer.x + 20, myPlayer.y + 20, 0xffffff);
  bullet.vx = dx * bulletSpeed;
  bullet.vy = dy * bulletSpeed;
  myBullets.push(bullet);

  // 서버에 발사 알림
  socket.emit("shoot", {
    x: bullet.x,
    y: bullet.y,
    vx: bullet.vx,
    vy: bullet.vy,
  });
}

let myHp = 100;
let enemyHp = 100;
const hpBar = new PIXI.Graphics();
app.stage.addChild(hpBar);

function updateHpBar() {
  hpBar.clear();
  hpBar.beginFill(0x00ff00);
  hpBar.drawRect(20, 20, (myHp / 100) * 200, 20);
  hpBar.endFill();
}

function rectsIntersect(a, b) {
  const ab = a.getBounds();
  const bb = b.getBounds();
  return (
    ab.x + ab.width > bb.x &&
    ab.x < bb.x + bb.width &&
    ab.y + ab.height > bb.y &&
    ab.y < bb.y + bb.height
  );
}

socket.on("updateHp", ({ id, hp }) => {
  if (id === socket.id) {
    myHp = hp;
  } else {
    enemyHp = hp;
  }
});

socket.on("youWin", () => {
  alert("🎉 You Win!");
  location.reload();
});

socket.on("youLose", () => {
  alert("💀 You Lose...");
  location.reload();
});

// 서버에서 내 위치 받기
socket.on("yourPlayer", ({ x, y }) => {
  myPlayer.x = x;
  myPlayer.y = y;
});
