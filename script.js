// 1) Firebase 콘솔 > 프로젝트 설정 > 내 앱에서 웹 앱을 등록하고 설정값을 붙여 넣으세요.
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";
import {
  getFirestore, collection, getDocs
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";

// 아래 값을 Firebase 웹 앱 설정 화면의 실제 값으로 바꾸세요.
const firebaseConfig = {
  apiKey: "AIzaSyAOeSIC8SHVs3zcrXmPYa9J6oKEKWu9D5I",
  authDomain: "our-class-draw.firebaseapp.com",
  projectId: "our-class-draw",
  storageBucket: "our-class-draw.firebasestorage.app",
  messagingSenderId: "983050768103",
  appId: "1:983050768103:web:9351688832288643b45c42",
  measurementId: "G-7T74PECT59"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

const loginPanel = document.querySelector("#loginPanel");
const drawPanel = document.querySelector("#drawPanel");
const loginBtn = document.querySelector("#loginBtn");
const logoutBtn = document.querySelector("#logoutBtn");
const drawBtn = document.querySelector("#drawBtn");
const resetBtn = document.querySelector("#resetBtn");
const result = document.querySelector("#result");
const resultHint = document.querySelector("#resultHint");
const classStatus = document.querySelector("#classStatus");
const progressText = document.querySelector("#progressText");
const progressBar = document.querySelector("#progressBar");
const remainingText = document.querySelector("#remainingText");
const loginMessage = document.querySelector("#loginMessage");
const appMessage = document.querySelector("#appMessage");

let students = [];
let pickedIds = new Set();
let busy = false;

function storageKey(user) {
  return `our-class-draw-picked-${user.uid}`;
}
function loadPicked(user) {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey(user)) || "[]");
    pickedIds = new Set(saved);
  } catch {
    pickedIds = new Set();
  }
  // 명단에서 삭제된 문서 ID는 진행 상태에서 제거
  const validIds = new Set(students.map(s => s.id));
  pickedIds = new Set([...pickedIds].filter(id => validIds.has(id)));
}
function savePicked(user) {
  localStorage.setItem(storageKey(user), JSON.stringify([...pickedIds]));
}
function updateProgress() {
  const total = students.length;
  const picked = Math.min(pickedIds.size, total);
  const remaining = Math.max(0, total - picked);
  progressText.textContent = `${picked} / ${total}명`;
  progressBar.style.width = total ? `${(picked / total) * 100}%` : "0%";
  remainingText.textContent = `남은 학생 ${remaining}명`;
  drawBtn.disabled = busy || total === 0 || remaining === 0;
  resetBtn.disabled = busy || picked === 0;
  if (total && remaining === 0) {
    classStatus.textContent = "모든 학생을 한 번씩 뽑았어요!";
    resultHint.textContent = "모두 뽑았습니다. 처음부터 버튼을 눌러 다시 시작하세요.";
  } else {
    classStatus.textContent = `학생 ${total}명 준비 완료`;
  }
}
async function loadStudents(user) {
  busy = true;
  drawBtn.disabled = true;
  classStatus.textContent = "학생 명단 불러오는 중";
  appMessage.textContent = "";
  try {
    const snapshot = await getDocs(collection(db, "students"));
    students = snapshot.docs
      .map(doc => ({ id: doc.id, name: String(doc.data().name ?? "").trim() }))
      .filter(s => s.name.length > 0)
      .sort((a, b) => a.name.localeCompare(b.name, "ko"));
    loadPicked(user);
    result.textContent = "준비됐나요?";
    resultHint.textContent = students.length
      ? "버튼을 눌러 친구 한 명을 뽑아 보세요."
      : "students 컬렉션에 name 필드가 있는 문서를 추가해 주세요.";
    updateProgress();
  } catch (error) {
    console.error(error);
    appMessage.textContent = "학생 명단을 불러오지 못했습니다. Firebase 설정과 Firestore 보안 규칙을 확인해 주세요.";
    classStatus.textContent = "명단을 불러오지 못했어요";
  } finally {
    busy = false;
    updateProgress();
  }
}
loginBtn.addEventListener("click", async () => {
  loginMessage.textContent = "";
  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    console.error(error);
    loginMessage.textContent = "로그인에 실패했습니다. Firebase Authentication 설정과 승인된 도메인을 확인해 주세요.";
  }
});
logoutBtn.addEventListener("click", () => signOut(auth));
drawBtn.addEventListener("click", async () => {
  if (busy || !auth.currentUser) return;
  const available = students.filter(s => !pickedIds.has(s.id));
  if (!available.length) {
    updateProgress();
    return;
  }
  busy = true;
  drawBtn.disabled = true;
  resetBtn.disabled = true;
  appMessage.textContent = "";
  // 짧은 셔플 애니메이션
  const endAt = Date.now() + 850;
  while (Date.now() < endAt) {
    result.textContent = available[Math.floor(Math.random() * available.length)].name;
    await new Promise(resolve => setTimeout(resolve, 70));
  }
  const winner = available[Math.floor(Math.random() * available.length)];
  pickedIds.add(winner.id);
  savePicked(auth.currentUser);
  result.textContent = winner.name;
  resultHint.textContent = "오늘의 주인공입니다! 축하해요!";
  busy = false;
  updateProgress();
});
resetBtn.addEventListener("click", () => {
  if (!auth.currentUser) return;
  const ok = confirm("뽑기 기록을 초기화하고 처음부터 다시 뽑을까요?");
  if (!ok) return;
  pickedIds = new Set();
  savePicked(auth.currentUser);
  result.textContent = "다시 시작!";
  resultHint.textContent = "아직 뽑히지 않은 친구가 없도록 새롭게 시작합니다.";
  appMessage.textContent = "";
  updateProgress();
});
onAuthStateChanged(auth, async user => {
  if (user) {
    loginPanel.hidden = true;
    drawPanel.hidden = false;
    await loadStudents(user);
  } else {
    students = [];
    pickedIds = new Set();
    drawPanel.hidden = true;
    loginPanel.hidden = false;
    loginMessage.textContent = "";
  }
});
