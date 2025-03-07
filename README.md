# Crowd Sensing with YOLOv11


## Table of Contents
1. [Introduction](#introduction)
2. [Setup](#setup)
3. [Usage](#usage)
4. [Testing](#testing)
5. [Context](#context)
6. [Contributing](#contributing)

## Introduction
For this project, our goal was to track the movement or flow of a crowd around a room and then introduce a stimulus to interact with that behaviour. Using [YOLOv11](https://docs.ultralytics.com/de/models/yolo11/), we created bounding boxes around people in a camera feed, then created a visualization for the detections using [p5js](https://p5js.org/).

We displayed our visualization on the floor, using a projector we hung from the ceiling. A detailed documentation of the whole project and the custom projector mount can be found on our [hackster documentation](https://www.hackster.io/531606/crowd-sensing-710fba).

## Setup
### Prerequisites
- Python 3.8+
- Node.js
- npm

### Installation
1. Clone the repository:
    ```bash
    git clone https://github.com/yourusername/crowd-sensing-yolov11.git
    cd crowd-sensing-yolov11
    ```

2. Install Python dependencies:
    ```bash
    pip install -r requirements.txt
    ```

3. Install Node.js dependencies:
    ```bash
    npm install
    ```

4. Set up the YOLOv11 model:
    ```bash
    # Download the YOLOv11 model and place it in the appropriate directory
    ```

## Usage
1. Start the backend server:
    ```bash
    python app.py
    ```

2. Start the frontend development server:
    ```bash
    npm start
    ```

3. Open your browser and navigate to `http://localhost:3000`.

## Testing
### Running Unit Tests
To run the unit tests, use the following command:
```bash
npm test

