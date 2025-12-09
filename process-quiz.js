import fs from 'fs';

const csv = fs.readFileSync('public/quiz.csv', 'utf-8');
const lines = csv.trim().split('\n');
const seen = new Set();
const questions = [];

for (let i = 1; i < lines.length; i++) {
  const line = lines[i];
  if (!line.trim()) continue;
  
  const parts = line.split(',');
  if (parts.length < 6) continue;
  
  const questionText = parts[0].trim();
  if (seen.has(questionText)) continue;
  
  seen.add(questionText);
  questions.push({
    text: questionText,
    options: {
      A: parts[1].trim(),
      B: parts[2].trim(),
      C: parts[3].trim(),
      D: parts[4].trim()
    },
    correct: parts[5].trim()
  });
}

console.log('Total de perguntas únicas:', questions.length);
fs.writeFileSync('public/quiz-data.json', JSON.stringify(questions, null, 2));
console.log('Salvo em public/quiz-data.json');
