/* 기본 스타일 */
body {
  font-family: Arial, sans-serif;
  background-color: #fffaf0;
  margin: 0;
  padding: 0;
}

.container {
  max-width: 100%;
  margin: auto;
  padding: 10px;
}

/* 제목 */
h1 {
  color: #b5651d;
  text-align: center;
  font-size: 1.8em;
}

.info-banner {
  background-color: #ffecd1;
  color: #b5651d;
  padding: 10px;
  text-align: center;
  border-radius: 5px;
  font-size: 0.9em;
}

/* 카드 스타일 */
.card {
  background-color: #fff5e6;
  border: 2px solid #b5651d;
  border-radius: 10px;
  padding: 15px;
  margin: 10px 0;
}

/* 버튼 */
button {
  background-color: #b5651d;
  color: white;
  border: none;
  padding: 10px 15px;
  border-radius: 8px;
  cursor: pointer;
  margin: 5px 0;
  font-size: 1em;
}

button:hover {
  background-color: #ffb74d;
}

/* 입력창 */
input[type="text"], input[type="number"] {
  width: calc(100% - 22px);
  padding: 8px;
  margin: 5px 0;
  border-radius: 5px;
  border: 1px solid #b5651d;
  font-size: 1em;
  box-sizing: border-box;
}

/* 리스트, 프리폼 */
ul, pre {
  background-color: #fff3e0;
  padding: 10px;
  border-radius: 5px;
  border: 1px solid #b5651d;
  font-size: 0.95em;
  overflow-x: auto;
}

/* 그리드 */
#weeklyGrid, #monthlyMealGrid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  gap: 5px;
  margin-top: 10px;
}

.week-day, .day-cell {
  background-color: #ffebcd;
  border: 1px solid #b5651d;
  border-radius: 5px;
  padding: 5px;
  word-break: break-word;
  font-size: 0.9em;
}

/* 모달 */
.modal {
  position: fixed;
  top:0;
  left:0;
  width:100%;
  height:100%;
  background: rgba(0,0,0,0.5);
  display: none;
  z-index: 1000;
}

.modal[aria-hidden="false"] {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px;
}

.modal-content {
  background: #fffaf0;
  width: 100%;
  max-width: 400px;
  padding: 20px;
  border-radius: 10px;
  max-height: 80vh;
  overflow-y: auto;
}

/* 모바일 반응형 */
@media screen and (max-width: 600px) {
  button, input[type="text"], input[type="number"] {
    font-size: 1em;
    padding: 10px;
  }

  .week-day, .day-cell {
    font-size: 0.85em;
    padding: 5px 3px;
  }
}
