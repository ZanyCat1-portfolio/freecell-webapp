# FreeCell Web Game

A self-hosted FreeCell web game, powered by Python and Docker.  
Clone, build, and run in minutes—no local Python environment required!

## Quick Start

### 1. Clone the repository

    git clone https://github.com/zanycat1/freecell-web.git
    cd freecell-web

### 2. Build the Docker image

    docker build -t freecell-web .

### 3. Run the container

    docker run --name freecell-game -p 5001:5000 freecell-web

The game will be available at:  
[http://localhost:5001](http://localhost:5001)

---

## Advanced: Custom Image Name & Port

- Change the image tag:

      docker build -t myfreecell:latest .

- Map a different host port:

      docker run --name my-freecell -p 8080:5000 myfreecell:latest

---

## Development

- All code and static assets are inside the container at `/app`.
- If you want to develop locally without Docker, install Python 3.11+ and use:

      pip install -r requirements.txt
      python app.py

---

## Container File Structure

- `requirements.txt` — Python dependencies
- `frontend/` — Static files (JS, CSS, HTML)
- `app.py` — Python backend
- `entrypoint.sh` — Container entry script

---

## Useful Docker commands

- **Stop the container:**  
      docker stop freecell-game

- **Remove the container:**  
      docker rm freecell-game

- **View logs:**  
      docker logs freecell-game

---

## License

MIT (or your license here)


## Attribution for Playing Card Images

Card images are from svg-cards by Byron Knoll,
released under the CC0 1.0 Universal (Public Domain Dedication).

Created by Byron Knoll.
More information: https://byronknoll.blogspot.com/2011/03/face-cards.html

No attribution is required, but is appreciated.