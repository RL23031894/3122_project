// Global variables
let currentFileId = null;
let currentGameId = null;
let gameState = null;
let currentQuestion = null;

// DOM elements
const steps = document.querySelectorAll('.step');
const uploadBtn = document.getElementById('uploadBtn');
const pdfUpload = document.getElementById('pdfUpload');
const uploadStatus = document.getElementById('uploadStatus');
const generationStatus = document.getElementById('generationStatus');
const generatedQuestions = document.getElementById('generatedQuestions');
const customizeBtn = document.getElementById('customizeBtn');
const saveCustomizationBtn = document.getElementById('saveCustomizationBtn');
const numPlayersSelect = document.getElementById('numPlayers');
const playerNamesDiv = document.getElementById('playerNames');
const startGameBtn = document.getElementById('startGameBtn');
const gameBoard = document.getElementById('gameBoard');
const currentPlayerDiv = document.getElementById('currentPlayer');
const diceResultDiv = document.getElementById('diceResult');
const rollDiceBtn = document.getElementById('rollDiceBtn');
const questionModal = document.getElementById('questionModal');
const questionText = document.getElementById('questionText');
const questionOptions = document.getElementById('questionOptions');
const targetPlayerSelection = document.getElementById('targetPlayerSelection');
const xSpacesSpan = document.getElementById('xSpaces');
const targetPlayerSelect = document.getElementById('targetPlayerSelect');
const moveForwardBtn = document.getElementById('moveForwardBtn');
const movePlayerBackBtn = document.getElementById('movePlayerBackBtn');
const gameResult = document.getElementById('gameResult');
const winnerMessage = document.getElementById('winnerMessage');
const playAgainBtn = document.getElementById('playAgainBtn');

// Event listeners
uploadBtn.addEventListener('click', handleUpload);
customizeBtn.addEventListener('click', showCustomizeStep);
saveCustomizationBtn.addEventListener('click', saveCustomization);
numPlayersSelect.addEventListener('change', setupPlayerInputs);
startGameBtn.addEventListener('click', startGame);
rollDiceBtn.addEventListener('click', rollDice);
moveForwardBtn.addEventListener('click', () => answerQuestion(true, null));
movePlayerBackBtn.addEventListener('click', () => {
    const targetPlayer = targetPlayerSelect.value;
    answerQuestion(true, targetPlayer);
});
playAgainBtn.addEventListener('click', resetGame);

// Initialize
setupPlayerInputs();

// Functions
function handleUpload() {
    if (!pdfUpload.files.length) {
        uploadStatus.textContent = 'Please select a PDF file first.';
        uploadStatus.style.color = 'red';
        return;
    }
    
    uploadStatus.textContent = 'Uploading...';
    uploadStatus.style.color = 'black';
    
    const formData = new FormData();
    formData.append('pdf', pdfUpload.files[0]);
    
    fetch('/upload', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            uploadStatus.textContent = 'Error: ' + data.error;
            uploadStatus.style.color = 'red';
        } else {
            uploadStatus.textContent = 'PDF uploaded successfully!';
            uploadStatus.style.color = 'green';
            currentFileId = data.file_id;
            showStep(2);
            generateQuestions();
        }
    })
    .catch(error => {
        uploadStatus.textContent = 'Error: ' + error.message;
        uploadStatus.style.color = 'red';
    });
}

function generateQuestions() {
    fetch('/generate_questions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            file_id: currentFileId
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            generationStatus.textContent = 'Error generating questions: ' + data.error;
        } else {
            currentGameId = data.game_id;
            displayGeneratedQuestions(data.questions);
            generatedQuestions.classList.remove('hidden');
        }
    })
    .catch(error => {
        generationStatus.textContent = 'Error: ' + error.message;
    });
}

function displayGeneratedQuestions(questions) {
    displayQuestionsForLevel('level1', questions.level1, 'level1Questions');
    displayQuestionsForLevel('level2', questions.level2, 'level2Questions');
    displayQuestionsForLevel('level3', questions.level3, 'level3Questions');
}

function displayQuestionsForLevel(level, questions, containerId) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    
    questions.forEach((q, i) => {
        const questionDiv = document.createElement('div');
        questionDiv.className = 'question-item';
        questionDiv.innerHTML = `
            <p><strong>Q${i+1}:</strong> ${q.question}</p>
            <ol type="A">
                ${q.options.map(opt => `<li>${opt}</li>`).join('')}
            </ol>
            <p><em>Correct answer: ${String.fromCharCode(65 + q.correct_answer)}</em></p>
        `;
        container.appendChild(questionDiv);
    });
}

function showCustomizeStep() {
    showStep(3);
    
    // Load questions for customization
    fetchQuestionsForCustomization();
}

function fetchQuestionsForCustomization() {
    fetch('/generate_questions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            file_id: currentFileId
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            alert('Error: ' + data.error);
        } else {
            displayCustomizableQuestions(data.questions);
        }
    })
    .catch(error => {
        alert('Error: ' + error.message);
    });
}

function displayCustomizableQuestions(questions) {
    displayCustomQuestionsForLevel('level1', questions.level1, 'customLevel1');
    displayCustomQuestionsForLevel('level2', questions.level2, 'customLevel2');
    displayCustomQuestionsForLevel('level3', questions.level3, 'customLevel3');
    
    // Update counts
    updateSelectionCounts();
}

function displayCustomQuestionsForLevel(level, questions, containerId) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    
    questions.forEach((q, i) => {
        const questionDiv = document.createElement('div');
        questionDiv.className = 'custom-question-item';
        questionDiv.innerHTML = `
            <input type="checkbox" id="${level}_${i}" data-level="${level}" data-index="${i}">
            <label for="${level}_${i}">${q.question}</label>
        `;
        const checkbox = questionDiv.querySelector('input');
        checkbox.addEventListener('change', updateSelectionCounts);
        container.appendChild(questionDiv);
    });
}

function updateSelectionCounts() {
    const level1Count = document.querySelectorAll('#customLevel1 input:checked').length;
    const level2Count = document.querySelectorAll('#customLevel2 input:checked').length;
    const level3Count = document.querySelectorAll('#customLevel3 input:checked').length;
    const total = level1Count + level2Count + level3Count;
    
    document.getElementById('level1Count').textContent = level1Count;
    document.getElementById('level2Count').textContent = level2Count;
    document.getElementById('level3Count').textContent = level3Count;
    document.getElementById('totalCount').textContent = `Total selected: ${total}`;
    
    saveCustomizationBtn.disabled = total < 30;
}

function saveCustomization() {
    const selectedQuestions = {
        level1: [],
        level2: [],
        level3: []
    };
    
    document.querySelectorAll('.customize-list input:checked').forEach(checkbox => {
        const level = checkbox.dataset.level;
        const index = checkbox.dataset.index;
        selectedQuestions[level].push(index);
    });
    
    fetch('/customize_questions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            game_id: currentGameId,
            selected_questions: selectedQuestions
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            alert('Error: ' + data.error);
        } else {
            showStep(4);
        }
    })
    .catch(error => {
        alert('Error: ' + error.message);
    });
}

function setupPlayerInputs() {
    const numPlayers = parseInt(numPlayersSelect.value);
    playerNamesDiv.innerHTML = '';
    
    for (let i = 0; i < numPlayers; i++) {
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = `Player ${i+1} Name`;
        input.required = true;
        playerNamesDiv.appendChild(input);
    }
}

function startGame() {
    const playerInputs = playerNamesDiv.querySelectorAll('input');
    const playerNames = Array.from(playerInputs).map(input => input.value.trim()).filter(name => name);
    
    if (playerNames.length !== parseInt(numPlayersSelect.value)) {
        alert('Please enter names for all players');
        return;
    }
    
    fetch('/start_game', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            game_id: currentGameId,
            player_names: playerNames
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            alert('Error: ' + data.error);
        } else {
            gameState = data.game_state;
            showStep(5);
            renderGameBoard();
            updateGameInfo();
        }
    })
    .catch(error => {
        alert('Error: ' + error.message);
    });
}

function renderGameBoard() {
    gameBoard.innerHTML = '';
    
    gameState.board.forEach((space, index) => {
        const spaceDiv = document.createElement('div');
        spaceDiv.className = 'board-space';
        
        if (space.level) {
            spaceDiv.classList.add(`level${space.level}`);
            spaceDiv.textContent = index + 1;
        } else {
            spaceDiv.classList.add('goal');
            spaceDiv.textContent = '🏁';
        }
        
        // Add player markers
        Object.entries(gameState.players).forEach(([name, player]) => {
            if (player.position === index) {
                const marker = document.createElement('div');
                marker.className = 'player-marker';
                marker.style.backgroundColor = player.color;
                marker.title = name;
                spaceDiv.appendChild(marker);
            }
        });
        
        gameBoard.appendChild(spaceDiv);
    });
}

function updateGameInfo() {
    const playerNames = Object.keys(gameState.players);
    const currentPlayerName = playerNames[gameState.current_player];
    currentPlayerDiv.textContent = `Current Player: ${currentPlayerName}`;
    currentPlayerDiv.style.color = gameState.players[currentPlayerName].color;
}

function rollDice() {
    rollDiceBtn.disabled = true;
    
    fetch('/roll_dice', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            game_id: currentGameId
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            alert('Error: ' + data.error);
            rollDiceBtn.disabled = false;
        } else {
            gameState = data.game_state;
            diceResultDiv.textContent = `You rolled a ${data.dice_roll}!`;
            
            // Move player
            movePlayer(data.dice_roll);
        }
    })
    .catch(error => {
        alert('Error: ' + error.message);
        rollDiceBtn.disabled = false;
    });
}

function movePlayer(steps) {
    fetch('/move_player', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            game_id: currentGameId,
            steps: steps
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            alert('Error: ' + data.error);
            rollDiceBtn.disabled = false;
        } else {
            gameState = data.game_state;
            renderGameBoard();
            
            if (data.question) {
                currentQuestion = data.question;
                showQuestionModal(data.question);
            } else {
                // No question, just move to next player
                nextTurn();
            }
            
            // Check for winner
            checkForWinner();
        }
    })
    .catch(error => {
        alert('Error: ' + error.message);
        rollDiceBtn.disabled = false;
    });
}

function showQuestionModal(question) {
    questionText.textContent = question.question;
    questionOptions.innerHTML = '';
    
    question.options.forEach((option, index) => {
        const optionDiv = document.createElement('div');
        optionDiv.className = 'question-option';
        optionDiv.textContent = `${String.fromCharCode(65 + index)}. ${option}`;
        optionDiv.addEventListener('click', () => answerQuestion(index === question.correct_answer));
        questionOptions.appendChild(optionDiv);
    });
    
    questionModal.classList.remove('hidden');
}

function answerQuestion(isCorrect, targetPlayer = null) {
    questionModal.classList.add('hidden');
    
    if (isCorrect && targetPlayer === null) {
        // Show options for correct answer
        const level = gameState.board[gameState.players[getCurrentPlayerName()].position].level;
        xSpacesSpan.textContent = level;
        
        // Setup target player selection
        targetPlayerSelect.innerHTML = '';
        Object.keys(gameState.players).forEach(name => {
            if (name !== getCurrentPlayerName()) {
                const option = document.createElement('option');
                option.value = name;
                option.textContent = name;
                targetPlayerSelect.appendChild(option);
            }
        });
        
        targetPlayerSelection.classList.remove('hidden');
        return;
    }
    
    fetch('/answer_question', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            game_id: currentGameId,
            answer_index: isCorrect ? currentQuestion.correct_answer : 0, // For demo, actual index would come from UI
            target_player: targetPlayer
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            alert('Error: ' + data.error);
        } else {
            gameState = data.game_state;
            renderGameBoard();
            
            if (isCorrect) {
                alert(`Correct! ${getCurrentPlayerName()} moves forward or chooses another player to move back.`);
            } else {
                alert(`Incorrect! The correct answer was ${String.fromCharCode(65 + data.correct_answer)}. ${getCurrentPlayerName()} moves back.`);
            }
            
            targetPlayerSelection.classList.add('hidden');
            nextTurn();
            checkForWinner();
        }
    })
    .catch(error => {
        alert('Error: ' + error.message);
    });
}

function nextTurn() {
    gameState.current_player = (gameState.current_player + 1) % Object.keys(gameState.players).length;
    updateGameInfo();
    diceResultDiv.textContent = '';
    rollDiceBtn.disabled = false;
}

function getCurrentPlayerName() {
    return Object.keys(gameState.players)[gameState.current_player];
}

function checkForWinner() {
    const players = Object.entries(gameState.players);
    const winner = players.find(([name, player]) => player.position >= gameState.board.length - 1);
    
    if (winner) {
        gameResult.classList.remove('hidden');
        winnerMessage.textContent = `${winner[0]} wins the game!`;
        rollDiceBtn.disabled = true;
    }
}

function resetGame() {
    gameResult.classList.add('hidden');
    showStep(1);
    currentFileId = null;
    currentGameId = null;
    gameState = null;
    currentQuestion = null;
    pdfUpload.value = '';
    uploadStatus.textContent = '';
}

function showStep(stepNumber) {
    steps.forEach((step, index) => {
        if (index + 1 === stepNumber) {
            step.classList.add('active');
        } else {
            step.classList.remove('active');
        }
    });
}