setup: package.json
	sudo apt-get install npm
	sudo npm install

run:
	node app.js
	echo "Server running at localhost:4000"
