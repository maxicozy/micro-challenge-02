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

![title-image](images/title-image.png)

## Setup
### Prerequisites
- Python 3.8+
- Node.js
- npm

### Installation
1. Enter the folder you want to clone the github repository into.
 
2. Clone the repository:
    ```bash
    git clone https://github.com/maxicozy/crowd-sensing-yolov11.git
    cd /maxicozy/crowd-sensing-yolov11/
    ```
2. Set up a virtual environment:

    - **On Windows:**
        1. Install `virtualenv`:
            ```bash
            pip install virtualenv
            ```
        2. Create a virtual environment:
            ```bash
            python -m venv venv
            ```
        3. Activate the virtual environment:
            - **Command Prompt:**
                ```bash
                venv\Scripts\activate
                ```
            - **PowerShell:**
                ```bash
                .\venv\Scripts\Activate.ps1
                ```
        4. Exit virtual environment:
            ```
            deactivate
            ```

    - **On Mac (or Linux):**
        1. Install `virtualenv`:
            ```bash
            pip install virtualenv
            ```
        2. Create a virtual environment:
            ```bash
            python3 -m venv venv
            ```
        3. Activate the virtual environment:
            ```bash
            source venv/bin/activate
            ```
        4. Exit virtual environment:
            ```
            deactivate
            ```

3. Install Python dependencies:
    ```bash
    pip install -r requirements.txt


## Usage
1. Start the backend server:
    ```bash
    python app.py
    ```
2. Open your browser and navigate to `http://localhost:3300`.

3. Scroll to reveal the control panel to select camera input and toggle vebcam feed and python visualization.



