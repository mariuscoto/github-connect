setup: package.json
	sudo add-apt-repository ppa:chris-lea/node.js -y
	sudo apt-get update
	sudo apt-get install nodejs -y
	npm config set registry http://registry.npmjs.org/
	sudo npm install

	sudo port install mongodb || sudo apt-get install mongodb
	NODE_ENV=development

	mongod &
	mongorestore -d github-connect ghconnect_db/github-connect
	killall mongod

run:
	@mongod &
	@echo "Server running at localhost:3000"
	@node app.js

db-export:
	rm -rf ghconnect_db
	mongod &
	mongodump -d github-connect -o ghconnect_db

db-import:
	mongod &
	mongorestore -d github-connect ghconnect_db/github-connect

db-drop:
	mongod &
	mongo github-connect --eval "db.dropDatabase();"
