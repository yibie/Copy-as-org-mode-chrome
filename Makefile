.PHONY: dev build xpi xpi-server clear zip-repo chrome-zip release

NAME=copy-as-org-mode
VERSION=$(shell grep '"version":' manifest.json | cut -d '"' -f 4)
BIN:="node_modules/.bin"
DIST_ZIP=${NAME}-v${VERSION}.zip

watch: clear
	./node_modules/.bin/webpack --mode=development --watch

build: clear
	./node_modules/.bin/webpack --mode=production

# Legacy Firefox target
xpi: clear build
	mkdir -p ../xpi
	zip -r -FS '../xpi/${NAME}.xpi' dist/ img/ manifest.json README.org LICENSE package.json

# Chrome/Chromium Packaging
chrome-zip: build
	rm -f ${DIST_ZIP}
	zip -r ${DIST_ZIP} dist/ img/ manifest.json README.org LICENSE package.json

# GitHub Release (Requires 'gh' CLI)
release: chrome-zip
	@echo "Creating release v${VERSION}..."
	git tag v${VERSION}
	git push origin v${VERSION}
	gh release create v${VERSION} ${DIST_ZIP} --title "v${VERSION}" --notes "Release v${VERSION}"

clear:
	rm -rf dist/*
	rm -f *.zip

update-readme-screenshot:
	${BIN}/ts-node -P ./tsconfig.json ./script/update-readme-screenshot.ts