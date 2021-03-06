/*
 */
(function(window, navigator) {
	'use strict';
	var document = window.document;
	/*
	 * getUserMedia
	 */
	navigator.getUserMedia = (navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia);
	/*
	 * Funky
	 */
	var funky = function() {
		/*
		 * Events
		 */
		this.events = {};
		/*
		 * Container
		 */
		this.container = null;
		/*
		 * Compatibility
		 */
		if(!navigator.getUserMedia) {
			return this.emit('error', { code: funky.ERR_COMPATIBILITY });
		}
		/*
		 * Options
		 */
		if(arguments.length === 0) {
			return this.emit('error', { code: funky.ERR_CONTAINER });
		}
		if(arguments.length === 1) {
			if(typeof arguments[0] === 'string') {
				this.options = {
					container: arguments[0]
				}
			} else {
				this.options = arguments[0] || {};
			}
		} else {
			this.options = {
				container: arguments[0]
			};
			for(var k in arguments[1]) {
				this.options[k] = arguments[1][k];
			}
		}
		if(!this.options.container || document.getElementById(this.options.container) === null) {
			return this.emit('error', { code: funky.ERR_CONTAINER });
		}
		this.container = document.getElementById(this.options.container);
		this.init();
	};

	/*
	 * Errors
	 */
	funky.ERR_OK = 0;
	funky.ERR_COMPATIBILITY = 1;
	funky.ERR_CONTAINER = 2;
	funky.ERR_PERMISSION = 3;

	/*
	 * Initialise
	 */
	funky.prototype.init = function() {
		var self = this;
		/*
		 * Setup the video and canvas elements
		 */
		this.videoBound = {
			width: 0,
			height: 0
		};
		this.video = document.createElement('video');
		this.video.setAttribute('autoplay', true);
		this.frontCanvas = document.createElement('canvas');
		this.frontCanvas.style.width = '100%';
		this.frontCanvas.style.height = '100%';
		this.frontCanvas.style.display = 'none';
		this.backCanvas = document.createElement('canvas');
		this.backCanvas.style.display = 'none';
		this.back = this.backCanvas.getContext('2d');
		this.front = this.frontCanvas.getContext('2d');
		this.container.appendChild(this.video);
		this.container.appendChild(this.frontCanvas);
		/*
		 * Listen for the video to begin playing
		 */
		this.video.addEventListener('play', function() {
			self.videoBound.width = self.video.clientWidth;
			self.videoBound.height = self.video.clientHeight;
			self.video.style.display = 'none';
			self.frontCanvas.style.display = 'block';
			self.frontCanvas.width = self.videoBound.width;
			self.frontCanvas.height = self.videoBound.height;
			self.backCanvas.width = self.videoBound.width;
			self.backCanvas.height = self.videoBound.height;
			clearTimeout(self.ticker);
			self.ticker = setTimeout(function() {
				self.draw.call(self);
			}, 25);
		}, false);
		/*
		 * Request the user media
		 */
		navigator.getUserMedia(
			{ video: true, audio: false },
			function(stream) {
				if(navigator.mozGetUserMedia) {
					self.video.mozSrcObject = stream;
				} else {
					var url = window.URL || window.webkitURL;
					self.video.src = url.createObjectURL(stream);
				}
				self.video.play();
			},
			function(e) {
				self.emit('error', { code: funky.ERR_PERMISSION });
			}
		);
	};
	
	/*
	 * Negative
	 */
	funky.prototype.effectNegative = function(enabled) {
		if(enabled) {
			if('-webkit-filter' in this.frontCanvas.style) {
				this.frontCanvas.style['-webkit-filter'] += ' invert(100%)';
			} else {
				this.frontCanvas.style['-webkit-filter'] = 'invert(100%)';
			}
		} else {
			if('-webkit-filter' in this.frontCanvas.style) {
				this.frontCanvas.style['-webkit-filter'] = this.frontCanvas.style['-webkit-filter'].replace(/ ?invert\(\d+%\)/, '');
			}
		}
	};

	/*
	 * Vertical mirror
	 */
	funky.prototype.effectVerticalMirror = function(enabled) {
		var vertical = function(image, cb) {
			var data = image.data,
				width = this.videoBound.width * 4,
				half = Math.floor(width / 2);
			for(var i = 0; i < data.length; i += 4) {
				var row = i - (i % width),
					x = (width - (i % width)),
					j = row + x;
				if(x < half) continue;
				data[j] = data[i];
				data[j+1] = data[i+1];
				data[j+2] = data[i+2];
			}
			cb();
		};
		if(enabled) {
			this.on('draw', vertical);
			this._effectVerticalMirror = this.events['draw'].length - 1;
		} else {
			this.off('draw', this.events['draw'][this._effectVerticalMirror]);
		}
	};

	/*
	 * Vertical flip
	 */
	funky.prototype.effectVerticalFlip = function(enabled) {
		var flip = function(image, cb) {
			var data = image.data,
				width = this.videoBound.width * 4,
				half = Math.floor(width / 2);
			for(var i = 0; i < data.length; i += 4) {
				var row = i - (i % width),
					x = (width - (i % width)),
					j = row + x;
				if(x < half) continue;
				var r = data[i],
					g = data[i+1],
					b = data[i+2];
				data[i] = data[j];
				data[i+1] = data[j+1];
				data[i+2] = data[j+2];
				data[j] = r;
				data[j+1] = g;
				data[j+2] = b;
			}
			cb();
		};
		if(enabled) {
			this.on('draw', flip);
			this._effectVerticalFlip = this.events['draw'].length - 1;
		} else {
			this.off('draw', this.events['draw'][this._effectVerticalFlip]);
		}
	};

	/*
	 * Edge detection
	 */
	funky.prototype.effectEdgeDetection = function(enabled) {
		var edge = function(image, cb) {
			var data = image.data,
				width = this.videoBound.width * 4,
				height = this.videoBound.height,
				gray = new Uint8ClampedArray(data.length),
				threshold = 20;
			for(var i = 0; i < data.length; i += 4) {
				var avg = Math.round((data[i] + data[i+1] + data[i+2]) / 3);
				gray[i] = gray[i+1] = gray[i+2] = avg;
				gray[i+3] = 0;
			}
			/*
			 * TODO: Blur it
			 */
			for(var i = 0; i < data.length; i += 4) {
				if(i === 0) continue;
				var y1 = Math.floor(i / width),
					y2 = Math.floor((i - 4) / width);
				if(y1 !== y2) continue;
				var avg = Math.abs(gray[i] - gray[i-4]);
				var avg2 = Math.abs(gray[i] - (gray[i - width] || 0));
				if(avg < threshold && avg2 < threshold) { data[i] = data[i+1] = data[i+2] = 0; continue; }
				data[i] = 255;
				data[i+1] = 0;
				data[i+2] = 0;
			}
			cb();
		};
		if(enabled) {
			this.on('draw', edge);
			this._effectEdgeDetection = this.events['draw'].length - 1;
		} else {
			this.off('draw', this.events['draw'][this._effectEdgeDetection]);
		}
	};
	
	/*
	 * Posterize
	 */
	funky.prototype.effectPosterize = function(enabled) {
		var poster = function(image, cb) {
			var data = image.data;
			for(var i = 0; i < data.length; i += 4) {
				var r = data[i], g = data[i+1], b = data[i+2];
				if(r < 32) r = 15;
				else if(r > 31 && r < 64) r = 47;
				else if(r > 63 && r < 96) r = 79;
				else if(r > 95 && r < 128) r = 111;
				else if(r > 127 && r < 160) r = 143;
				else if(r > 159 && r < 192) r = 175;
				else if(r > 191 && r < 224) r = 207;
				else if(r > 223 && r < 256) r = 239;
				if(g < 32) g = 15;
				else if(g > 31 && g < 64) g = 47;
				else if(g > 63 && g < 96) g = 79;
				else if(g > 95 && g < 128) g = 111;
				else if(g > 127 && g < 160) g = 143;
				else if(g > 159 && g < 192) g = 175;
				else if(g > 191 && g < 224) g = 207;
				else if(g > 223 && g < 256) g = 239;
				if(b < 32) b = 15;
				else if(b > 31 && b < 64) b = 47;
				else if(b > 63 && b < 96) b = 79;
				else if(b > 95 && b < 128) b = 111;
				else if(b > 127 && b < 160) b = 143;
				else if(b > 159 && b < 192) b = 175;
				else if(b > 191 && b < 224) b = 207;
				else if(b > 223 && b < 256) b = 239;
				data[i] = r; data[i+1] = g; data[i+2] = b;
			}
			cb();
		};
		if(enabled) {
			this.on('draw', poster);
			this._effectPosterize = this.events['draw'].length - 1;
		} else {
			this.off('draw', this.events['draw'][this._effectPosterize]);
		}
	};

	/*
	 * Sepia
	 */
	funky.prototype.effectSepia = function(enabled) {
		if(enabled) {
			if('-webkit-filter' in this.frontCanvas.style) {
				this.frontCanvas.style['-webkit-filter'] += ' sepia(100%)';
			} else {
				this.frontCanvas.style['-webkit-filter'] = 'sepia(100%)';
			}
		} else {
			if('-webkit-filter' in this.frontCanvas.style) {
				this.frontCanvas.style['-webkit-filter'] = this.frontCanvas.style['-webkit-filter'].replace(/ ?sepia\(\d+%\)/, '');
			}
		}
	};

	/*
	 * Random Offset
	 */
	funky.prototype.effectRandomOffset = function(enabled) {
		var random = function(image, cb) {
			var data = image.data,
				width = this.videoBound.width * 4;
			for(var i = 0; i < data.length; i += 4) {
				var r = data[i], g = data[i+1], b = data[i+2];
				var rnd = Math.random(), j;
				if(rnd < 0.25) j = i - width;
				else if(rnd < 0.5) j = i + 4;
				else if(rnd < 0.75) j = i + width;
				else j = i - 4;
				if(data[j] !== undefined) {
					data[i] = data[j]; data[i+1] = data[j+1]; data[i+2] = data[j+2];
					data[j] = r; data[j+1] = g; data[j+2] = b;
				}
			}
			cb();
		};
		if(enabled) {
			this.on('draw', random);
			this._effectRandomOffset = this.events['draw'].length - 1;
		} else {
			this.off('draw', this.events['draw'][this._effectRandomOffset]);
		}
	};

	/*
	 * Edge detection 2
	 */
	funky.prototype.effectEdgeDetectionAlt = function(enabled) {
		var edge = function(image, cb) {
			var data = image.data,
				width = this.videoBound.width * 4,
				height = this.videoBound.height,
				kernel = [-1, -1, -1, -1, 8, -1, -1, -1, -1],
				gray = new Uint8ClampedArray(data.length);
			for(var i = 0; i < data.length; i += 4) {
				var avg = Math.round((data[i] + data[i+1] + data[i+2]) / 3);
				gray[i] = gray[i+1] = gray[i+2] = avg;
				gray[i+3] = 0;
			}
			for(var i = 0; i < gray.length; i += 4) {
				var box = [
					gray[i - width - 4] || 0,
					gray[i - width] || 0,
					gray[i - width + 4] || 0,

					gray[i - 4] || 0,
					gray[i],
					gray[i + 4] || 0,

					gray[i + width - 4] || 0,
					gray[i + width] || 0,
					gray[i + width + 4] || 0
				];
				var x = (width - (i % width)),
					y = Math.floor(i / width);
				if(y === 0) {
					box[0] = gray[i - width] || 0;
					box[3] = gray[i];
					box[6] = gray[i + width] || 0;
				} else if(y === height) {
					box[2] = gray[i - width] || 0;
					box[5] = gray[i];
					box[8] = gray[i + width] || 0;
				}
				if(x === 0) {
					box[0] = gray[i - 4] || 0;
					box[1] = gray[i];
					box[2] = gray[i + 4] || 0;
				} else if(x === width) {
					box[6] = gray[i - 4] || 0;
					box[7] = gray[i];
					box[8] = gray[i + 4] || 0;
				}
				if(i === 0) {
					box[0] = gray[i];
				} else if(i === width) {
					box[2] = gray[i];
				} else if(y === height && x === 0) {
					box[6] = gray[i];
				} else if(y === height && x === width) {
					box[8] = gray[i];
				}
				var conv = (kernel[0] * box[0]) + (kernel[1] * box[1]) + (kernel[2] * box[2])
					+ (kernel[3] * box[3]) + (kernel[4] * box[4]) + (kernel[5] * box[5])
					+ (kernel[6] * box[6]) + (kernel[7] * box[7]) + (kernel[8] * box[8]);
				data[i] = data[i+1] = data[i+2] = conv;
			}
			cb();
		};
		if(enabled) {
			this.on('draw', edge);
			this._effectEdgeDetectionAlt = this.events['draw'].length - 1;
		} else {
			this.off('draw', this.events['draw'][this._effectEdgeDetectionAlt]);
		}
	};

	/*
	 * Scan lines
	 */
	funky.prototype.effectScanLines = function(enabled) {
		var scan = function(image, cb) {
			var data = image.data,
				width = this.videoBound.width,
				height = this.videoBound.height;
			for(var i = 0; i < data.length; i += 4) {
				var x = width - ((i / 4) % width);
				if(x % 2 === 0) continue;
				data[i] = data[i+1] = data[i+2] = (data[i] + data[i+1] + data[i+2]) / 3;
			}
			cb();
		};
		if(enabled) {
			this.on('draw', scan);
			this._effectScanLines = this.events['draw'].length - 1;
		} else {
			this.off('draw', this.events['draw'][this._effectScanLines]);
		}
	};

	/*
	 * RGB Shifting effect [by pooyarm]
	 */
	funky.prototype.effectRgbshifting = function(enabled){
		var rgbshifting = function(image, callback) {
			var imageX = 0;
			var imageY = 0;
			var imageWidth = this.videoBound.width;
			var imageHeight = this.videoBound.height;

			var _radius = parseInt(imageWidth * 1.6 / 100);

			var Original 		= image;
			var OriginalData 	= image.data;
			var PlusData		= new Array();
			var MinusData		= new Array();

			for(var y = 0; y < imageHeight; y++) {
				for(var x = 0; x < imageWidth; x++) {
					var index 		= ((imageWidth * y) + x ) * 4;

					var PlusIndex	= ((imageWidth * y) + (x + _radius)) * 4;
					var MinusIndex	= ((imageWidth * y) + (x + _radius * -1)) * 4;

					PlusData[PlusIndex]		= OriginalData[index];
					PlusData[PlusIndex + 1]	= OriginalData[index + 1];
					PlusData[PlusIndex + 2]	= OriginalData[index + 2];
					PlusData[PlusIndex + 3]	= OriginalData[index + 3];

					MinusData[MinusIndex]		= OriginalData[index];
					MinusData[MinusIndex + 1]	= OriginalData[index + 1];
					MinusData[MinusIndex + 2]	= OriginalData[index + 2];
					MinusData[MinusIndex + 3]	= OriginalData[index + 3];
				}
			}

			for(var i = 0, n = OriginalData.length; i < n; i += 4) {
				if(typeof PlusData[i] != 'undefined')
				{
					OriginalData[i] 	= PlusData[i];
					OriginalData[i + 1] = PlusData[i + 1] * 0.5 + OriginalData[i + 1] * 0.5;
					OriginalData[i + 2] = PlusData[i + 2];
				}

				if(typeof MinusData[i] != 'undefined')
				{
					OriginalData[i] 	= MinusData[i] * 0.5 + OriginalData[i] * 0.5;
					OriginalData[i + 1] = OriginalData[i + 1];
					OriginalData[i + 2] = MinusData[i + 2];
				}

				OriginalData[i + 3] = 255;
			}
			
			//image.data = OriginalData;
			callback();
		}
		if(enabled) {
			this.on('draw', rgbshifting);
			this._effectRgbshifting = this.events['draw'].length - 1;
		} else {
			this.off('draw', this.events['draw'][this._effectRgbshifting]);
		}
	};

	/*
	 * Doodle TODO
	 */
	funky.prototype.effectDoodle = function(enabled) {
		var self = this;
		var mouseup, mousedown;
		var removed = function() {
			if(!('doodle' in self.processes)) {
				self.frontCanvas.removeEventListener('mousedown', mousedown);
				self.frontCanvas.removeEventListener('mouseup', mouseup);
				self.effectDoodleEnabled = false;
				return true;
			}
			return false;
		};
		if(!this.effectDoodleEnabled) {
			this.effectDoodleEnabled = true;
			mousedown = this.frontCanvas.addEventListener('mousedown', function(e) {
				if(removed()) return;
				console.log(self.mousePosition(e));
			});
			mouseup = this.frontCanvas.addEventListener('mouseup', function(e) {
				if(removed()) return;
				console.log(self.mousePosition(e));
			});
		}
		var data = image.data,
			width = this.videoBound.width,
			height = this.videoBound.height;
		for(var i = 0; i < data.length; i += 4) {
		}
		cb();
	};

	/*
	 * Mouse positioning
	 */
	funky.prototype.mousePosition = function(e) {
		var bounds = e.target.getBoundingClientRect();
		var pos = {x: 0, y: 0};
		pos.x = e.pageX - bounds.left - window.scrollX;
		pos.y = e.pageY - bounds.top - window.scrollY;
		return pos;
	};
	
	/*
	 * Draw
	 */
	funky.prototype.draw = function() {
		var self = this;
		this.back.drawImage(this.video, 0, 0, this.videoBound.width, this.videoBound.height);
		var image = this.back.getImageData(0, 0, this.videoBound.width, this.videoBound.height);
		var total = ('draw' in this.events) ? this.events['draw'].length : 0,
			done = 0,
			cb = function() {
				done++;
				if(done < total) return;
				self.front.putImageData(image, 0, 0);
				self.ticker = setTimeout(function() {
					self.draw.call(self);
				}, 25);
			};
		if(total === 0) {
			return cb();
		}
		this.emit('draw', image, cb);
	};

	/*
	 * Event emitter
	 */
	funky.prototype.emit = function() {
		var self = this;
		var type = arguments[0],
			args = Array.prototype.slice.call(arguments, 1);
		if(!(type in this.events)) return;
		this.events[type].forEach(function(e) {
			e.apply(self, args);
		});
	};

	/*
	 * Event attach
	 */
	funky.prototype.on = function(type, callback) {
		if(!(type in this.events)) {
			this.events[type] = [];
		}
		this.events[type].push(callback);
	};

	/*
	 * Event detach
	 */
	funky.prototype.off = function(type, callback) {
		if(!(type in this.events)) return;
		var idx = this.events[type].indexOf(callback);
		if(idx === -1) return;
		this.events[type].splice(idx, 1);
	};

	window.funky = funky;
})(window, navigator);
