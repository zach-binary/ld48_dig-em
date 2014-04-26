define(['game/graphics', 
		'shared/game/physics',
		'game/input'], 
		function(Graphics, Physics, Input) {
	var Systems = {};

	Graphics.Systems.box = function(e, c) {
		var offset = Graphics.offset,
			context = Graphics.context;

		context.save();
		context.fillStyle = c.color;
		context.translate(-offset.x, -offset.y);

		if (e.components.stun)
			context.globalAlpha = 0.3;

		context.fillRect(e.body.x, e.body.y, e.body.bounds.w, e.body.bounds.h);

		context.restore();
	};

	Graphics.Systems.player = function(e, c) {
		var context = Graphics.context,
			i = e.components.health;

		context.save();

		while(i--) {
			context.fillRect(10 + i * 15, 10, 10, 10);
		}

		context.restore();
	};

	Graphics.Systems.dig_grid = function(e, c) {
		var i, length = c.map.length,
			xOffset = 0,
			yOffset = 0;

		Graphics.context.save();
		Graphics.context.translate(-Graphics.offset.x, -Graphics.offset.y);

		for(i = 0; i < length; i++) {
			if (c.map[i])
				Graphics.context.fillRect(e.body.x + xOffset,
					e.body.y + yOffset,
					c.node_size.w,
					c.node_size.h
				);

			if ((i + 1) % c.width === 0) {
				xOffset = 0;
				yOffset += c.node_size.h;
			}
			else
				xOffset += c.node_size.w;
		}

		Graphics.context.restore();
	};

	Systems.player_controlled = function(e, c) {
		e.body.vel = { x: 0, y: 0 };

		if (Input.KeyDown(c.up)) 
			e.body.vel.y = -c.speed;
		if (Input.KeyDown(c.down))
			e.body.vel.y = c.speed;
		if (Input.KeyDown(c.left))
			e.body.vel.x = -c.speed;
		if (Input.KeyDown(c.right))
			e.body.vel.x = c.speed;
	};

	Systems.dig = function(e, c) {
		var grid = e.Touches('dig_grid')[0];

		if (grid && Input.KeyPressed(c.command)) {
			_createHole(e, grid.entity);
		}
	};

	Systems.physical = function(e, c) {
		var touches = e.Touches('collision_map'),
			i = touches.length;

		while(i--) {
			e.body.x += touches[i].mtd.x;
			e.body.y += touches[i].mtd.y;
		}
	};

	Systems.health = function(e, health) {
		if (health <= 0) {
			e.Kill();
		}
	};

	Systems.hurts_player = function(e, c) {
		var players = e.Touches('player'),
			i = players.length,
			mtd, player;

		while(i--) {
			mtd = _normalize(players[i].mtd);
			player = players[i].entity;

			if (player.components.stun)
				continue;

			if (mtd.x)
				player.body.x -= mtd.x * c.pushback;
			if (mtd.y)
				player.body.y -= mtd.y * c.pushback;

			if (player.components.health)
				player.components.health -= c.damage;

			player.components.stun = {
				elapsed: 0,
				interval: 300
			};
		}
	};

	Systems.ai_controlled = function(e, c) {
		if (c.last_pos) {
			var traveledDistance = {
				x: e.body.x - c.last_pos.x,
				y: e.body.y - c.last_pos.y
			};

			c.last_pos.x = e.body.x;
			c.last_pos.y = e.body.y;

			c.steps_taken += _magnitude(traveledDistance);

			if (c.steps_taken >= c.step_size) {
				c.last_pos = null;
				c.steps_taken = 0;

				e.body.vel.x = 0;
				e.body.vel.y = 0;
			}

			var collision_map = e.Touches('collision_map')[0];

			if (collision_map) {
				e.body.vel.x = -e.body.vel.x;
				e.body.vel.y = -e.body.vel.y;
			}
		}
		else {
			c.elapsed += Physics.delta;

			if (c.elapsed >= c.interval) {
				c.last_pos = {
					x: e.body.x,
					y: e.body.y
				};
				c.elapsed = 0;
				c.steps_taken = 0;

				var speed = Math.random() > 0.5 ? -c.speed : c.speed;

				if (Math.random() > 0.5)
					e.body.vel.x = speed;
				else
					e.body.vel.y = speed;
			}
		}
	};

	Systems.falls = function(e, c) {
		var grid = e.Touches('dig_grid')[0];

		if (grid) {
			grid = grid.entity;

			if(_willFallInGap(e, grid.components.dig_grid, grid)) {
				e.body.x += 1070; 
				if (e.components.player)
					Graphics.offset.x += 1000;
			}
		}	
	};

	Systems.stun = function(e, c) {
		e.body.vel.x = 0;
		e.body.vel.y = 0;

		c.elapsed += Physics.delta;

		if (c.elapsed >= c.interval) {
			delete e.components.stun;
		}
	};

	function _normalize(v) {
		var magnitude = _magnitude(v);

		if (magnitude > 0)
			return {
				x: v.x / magnitude,
				y: v.y / magnitude
			};
		else
			return { x: 0, y: 0 };
	}

	function _magnitude(v) {
		var magnitude;

		magnitude = Math.pow(v.x, 2) + Math.pow(v.y, 2);
		magnitude = Math.sqrt(magnitude);

		return magnitude;
	}

	function _createHole(e, grid) {
		var translation = {},
			dig_grid = grid.components.dig_grid,
			x, y, index;

		translation.x = e.body.x - grid.body.x;
		translation.y = e.body.y - grid.body.y;

		x = Math.floor(translation.x / dig_grid.node_size.w);
		y = Math.floor(translation.y / dig_grid.node_size.h);

		index = x + (y * dig_grid.width);
		_createHolesRecursive(index, dig_grid, 0);
	}

	function _createHolesRecursive(index, dig_grid, level) {
		if (!dig_grid.map[index])
			dig_grid.map[index] = true;
		else if (level > 3)
			return;
		else {
			var left = index - 1;
			var right = index + 1;
			var up = index + dig_grid.width;
			var down = index - dig_grid.width;

			if (right % dig_grid.width !== 0)
				_createHolesRecursive(right, dig_grid, level + 1);

			if (left % dig_grid.width !== 0)
				_createHolesRecursive(left, dig_grid, level + 1);

			if (up % dig_grid.height !== 0)
				_createHolesRecursive(up, dig_grid, level + 1);

			if (down % dig_grid.height !== 0)
				_createHolesRecursive(down, dig_grid, level + 1);
		}
	}

	function _willFallInGap(e, c, dig_grid) {
		var i, maplength = c.map.length,
			width, height, length,
			xOffset = 0, yOffset = 0,
			x, y, index,
			translation = {};

		translation.x = e.body.x - dig_grid.body.x;
		translation.y = e.body.y - dig_grid.body.y;

		x = Math.floor(translation.x / c.node_size.w);
		y = Math.floor(translation.y / c.node_size.h);
		xOffset = x;

		width = e.body.bounds.w / c.node_size.w;
		height = e.body.bounds.h / c.node_size.h;
		length = width * height;

		for(i = 0; i < length; i++) {
			index = y * c.width + xOffset;

			if ((i + 1) % width === 0) {
				xOffset = x;
				y++;
			}
			else
				xOffset++;

			if (index > maplength || !c.map[index])
				return false;
		}

		return true;

	}

	return Systems;
});