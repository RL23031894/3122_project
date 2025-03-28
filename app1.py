from flask import Flask, render_template, request, jsonify
import os
import PyPDF2
import openai
import json
import random
from io import BytesIO

app = Flask(__name__)

# Configure OpenAI API (you'll need to set up your own API key)
openai.api_key = os.getenv('OPENAI_API_KEY')

# In-memory storage for game data (in a real app, use a database)
games = {}
pdf_texts = {}
questions_db = {}

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload_pdf():
    if 'pdf' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400
    
    file = request.files['pdf']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    if file and file.filename.endswith('.pdf'):
        # Read PDF text
        pdf_reader = PyPDF2.PdfReader(BytesIO(file.read()))
        text = ""
        for page in pdf_reader.pages:
            text += page.extract_text()
        
        # Store PDF text with a unique ID
        file_id = str(random.randint(1000, 9999))
        pdf_texts[file_id] = text
        
        return jsonify({'file_id': file_id})
    
    return jsonify({'error': 'Invalid file format'}), 400

@app.route('/generate_questions', methods=['POST'])
def generate_questions():
    data = request.json
    file_id = data.get('file_id')
    if not file_id or file_id not in pdf_texts:
        return jsonify({'error': 'Invalid file ID'}), 400
    
    text = pdf_texts[file_id]
    
    try:
        # Generate questions using OpenAI API
        prompt = f"""
        Based on the following text, generate 60 multiple choice questions (4 options each, 1 correct answer).
        Categorize them into 3 difficulty levels (20 questions each: Level 1, Level 2, Level 3).
        Format as JSON with keys: level1, level2, level3.
        Each question should have: 'question', 'options' (list), 'correct_answer' (index 0-3).
        Text: {text[:10000]}  # Limiting to first 10k chars for demo
        """
        
        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7
        )
        
        questions = json.loads(response.choices[0].message.content)
        
        # Store questions with a unique game ID
        game_id = str(random.randint(1000, 9999))
        questions_db[game_id] = questions
        
        return jsonify({
            'game_id': game_id,
            'questions': questions
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/customize_questions', methods=['POST'])
def customize_questions():
    data = request.json
    game_id = data.get('game_id')
    selected_questions = data.get('selected_questions')
    
    if not game_id or game_id not in questions_db:
        return jsonify({'error': 'Invalid game ID'}), 400
    
    # Validate at least 30 questions are selected
    total = sum(len(questions) for questions in selected_questions.values())
    if total < 30:
        return jsonify({'error': 'Please select at least 30 questions'}), 400
    
    # Update the questions for this game
    customized_questions = {
        'level1': [q for i, q in enumerate(questions_db[game_id]['level1']) if str(i) in selected_questions.get('level1', [])],
        'level2': [q for i, q in enumerate(questions_db[game_id]['level2']) if str(i) in selected_questions.get('level2', [])],
        'level3': [q for i, q in enumerate(questions_db[game_id]['level3']) if str(i) in selected_questions.get('level3', [])]
    }
    
    questions_db[game_id] = customized_questions
    return jsonify({'success': True})

@app.route('/start_game', methods=['POST'])
def start_game():
    data = request.json
    game_id = data.get('game_id')
    player_names = data.get('player_names')
    
    if not game_id or game_id not in questions_db:
        return jsonify({'error': 'Invalid game ID'}), 400
    
    if len(player_names) < 2 or len(player_names) > 4:
        return jsonify({'error': 'Number of players must be between 2 and 4'}), 400
    
    # Initialize game state
    game_state = {
        'players': {name: {'position': 0, 'color': get_player_color(i)} 
                   for i, name in enumerate(player_names)},
        'current_player': 0,
        'used_questions': {'level1': [], 'level2': [], 'level3': []},
        'questions': questions_db[game_id],
        'board': generate_board()
    }
    
    games[game_id] = game_state
    return jsonify({'game_state': game_state})

def get_player_color(index):
    colors = ['red', 'blue', 'green', 'yellow']
    return colors[index]

def generate_board():
    # Generate a board with 50 spaces (adjust as needed)
    # Every 10 spaces is a "level" area
    board = []
    for i in range(1, 51):
        if i < 10:
            level = 1
        elif i < 30:
            level = 2
        else:
            level = 3
        board.append({'number': i, 'level': level if i < 45 else None})  # Last 5 are goal
    return board

@app.route('/roll_dice', methods=['POST'])
def roll_dice():
    data = request.json
    game_id = data.get('game_id')
    
    if not game_id or game_id not in games:
        return jsonify({'error': 'Invalid game ID'}), 400
    
    game_state = games[game_id]
    dice_roll = random.randint(1, 6)
    
    return jsonify({
        'dice_roll': dice_roll,
        'game_state': game_state
    })

@app.route('/move_player', methods=['POST'])
def move_player():
    data = request.json
    game_id = data.get('game_id')
    steps = data.get('steps')
    
    if not game_id or game_id not in games:
        return jsonify({'error': 'Invalid game ID'}), 400
    
    game_state = games[game_id]
    current_player_index = game_state['current_player']
    player_names = list(game_state['players'].keys())
    current_player = player_names[current_player_index]
    
    # Move player forward
    current_position = game_state['players'][current_player]['position']
    new_position = current_position + steps
    
    # Check if player passed the end
    if new_position >= len(game_state['board']):
        new_position = len(game_state['board']) - 1
    
    game_state['players'][current_player]['position'] = new_position
    
    # Check if we need to ask a question
    board_space = game_state['board'][new_position]
    question = None
    
    if board_space['level'] is not None:
        level = f"level{board_space['level']}"
        available_questions = [
            q for i, q in enumerate(game_state['questions'][level]) 
            if i not in game_state['used_questions'][level]
        ]
        
        if available_questions:
            question = random.choice(available_questions)
            question_index = game_state['questions'][level].index(question)
            game_state['used_questions'][level].append(question_index)
    
    games[game_id] = game_state
    
    return jsonify({
        'new_position': new_position,
        'question': question,
        'game_state': game_state
    })

@app.route('/answer_question', methods=['POST'])
def answer_question():
    data = request.json
    game_id = data.get('game_id')
    answer_index = data.get('answer_index')
    target_player = data.get('target_player')
    
    if not game_id or game_id not in games:
        return jsonify({'error': 'Invalid game ID'}), 400
    
    game_state = games[game_id]
    current_player_index = game_state['current_player']
    player_names = list(game_state['players'].keys())
    current_player = player_names[current_player_index]
    
    # Get the current position and level
    current_position = game_state['players'][current_player]['position']
    board_space = game_state['board'][current_position]
    level = board_space['level']
    
    # Find the question that was asked
    level_key = f"level{level}"
    last_used_index = game_state['used_questions'][level_key][-1]
    question = game_state['questions'][level_key][last_used_index]
    
    # Check answer
    is_correct = (answer_index == question['correct_answer'])
    x = level  # Number of spaces to move
    
    if is_correct:
        if target_player:  # Player chose to move another player back
            game_state['players'][target_player]['position'] = max(
                0, game_state['players'][target_player]['position'] - x
            )
        else:  # Player moves forward
            game_state['players'][current_player]['position'] = min(
                len(game_state['board']) - 1,
                game_state['players'][current_player]['position'] + x
            )
    else:
        # Move current player back
        game_state['players'][current_player]['position'] = max(
            0, game_state['players'][current_player]['position'] - x
        )
    
    # Move to next player
    game_state['current_player'] = (current_player_index + 1) % len(player_names)
    games[game_id] = game_state
    
    return jsonify({
        'is_correct': is_correct,
        'correct_answer': question['correct_answer'],
        'game_state': game_state
    })

if __name__ == '__main__':
    app.run(debug=True)

    