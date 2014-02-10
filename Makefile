setup: package.json
	sudo add-apt-repository ppa:chris-lea/node.js -y
	sudo apt-get update
	sudo apt-get install nodejs -y
	npm config set registry http://registry.npmjs.org/
	sudo npm install

run:
	echo "Server running at localhost:4000"
	node app.js
