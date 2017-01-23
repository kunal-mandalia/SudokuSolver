/**
 * sudokuSolver.js
 * 
 * postulates:
 * 1. each line contains the numbers 1-9
 * 	=> there cannot be duplicate numbers on any line
 * 2. each 3x3 subgrids (rows/cols 1-3, 4-6, 7-9) contain the numbers 1 to 9
 * 	=> there cannot be duplicate numbers in any subgrid
 */
(function(window){

	const S = {}; // global Sudoku Solver object, exposed to window
	// let Grid = {}; // global grid object, private (not exposed to window)
	S.stop = false;
	// S.progressByCycle = []; // progressByCycle[k]=m => m possibilities removed on cycle k
	S.toBeRemoved = []; // [{r, c, n}, ...]
	S.hasBeenRemoved = []; // [{r, c, n}, ...]
	S.editMode = false;
	/**
	 * Core algorithms
	 */

	/**
	 * Given a known value, n, at grid position i,j, we know that
	 * from postulate 1, row i and col j must not contain value n.
	 * Find all instances of these redudant possibilities (so they can be removed).
	 * The possibilities aren't removed within this function to keep it pure
	 * 
	 * 
	 * @params i, j, n : the row, column, and actual grid value found
	 * 	this notation/convention is used throughout the library
	 */
	function findRedundantLinearPossibilities(i,j,n,G) {
		let rows = [1,2,3,4,5,6,7,8,9].filter(v => { return v !== i; } );
		let cols = [1,2,3,4,5,6,7,8,9].filter(v => { return v !== j; } );
		let redundantGV = []; // [{r:, c:}, ...]

		rows.forEach( r => {
			// redundant possibility exists			
			if (G[r][j].indexOf(n) !== -1) {
				redundantGV.push({r:r, c:j, n:n});
			}
		});

		cols.forEach( c => {
			// redundant possibility exists			
			if (G[i][c].indexOf(n) !== -1) {
				redundantGV.push({r:i, c:c, n:n});
			}
		});

		return redundantGV;
	}
	S.findRedundantLinearPossibilities = findRedundantLinearPossibilities;

	function test_findRedundantLinearPossibilities(logOutput) {
		let grid = getTestGrid();
		let redundantGV = findRedundantLinearPossibilities(6, 9, 8, grid);
		
		let t1 = (redundantGV.length === 11 );
		console.assert(t1, 'failed test_findRedundantLinearPossibilities: redundantGV', redundantGV);
		if (logOutput) { console.log(redundantGV, 'output for test_findRedundantLinearPossibilities redundantGV')};
	}
	S.test_findRedundantLinearPossibilities = test_findRedundantLinearPossibilities;

	/**
	 * given a known value within a subgrid, find where
	 * n is listed as a possibility within other cells inside the subgrid
	 * so they can be removed
	 */
	function findRedundantBoxPossibilities(i, j, n, G) {
		// box rows
		let br = [];
		if (i<4) {
			br = [1,2,3];
		} else if (i<7) {
			br = [4,5,6];
		} else {
			br = [7,8,9];
		}
		// box cols
		let bc = [];
		if (j<4) {
			bc = [1,2,3];
		} else if (j<7) {
			bc = [4,5,6];
		} else {
			bc = [7,8,9];
		}

		let redundantGV = [];

		br.forEach(r => {
			bc.forEach(c => {
				if (!((r === i) && (c === j))) {
					if (G[r][c].indexOf(n) !== -1) {
						redundantGV.push({r:r, c:c, n:n});
					}
				}
			})
		});
		
		return redundantGV;
	}

	function test_findRedundantBoxPossibilities(logOutput) {
		let grid = getTestGrid();
		let redundantGV = findRedundantBoxPossibilities(4, 2, 8, grid);

		let t1 = redundantGV.length === 5;
		console.assert(t1, 'failed test_findRedundantBoxPossibilities: redundantGV', redundantGV);

		if (logOutput) { console.log(redundantGV, 'output from test_findRedundantBoxPossibilities redundantGV')};
	}
	S.test_findRedundantBoxPossibilities = test_findRedundantBoxPossibilities;

	/**
	 * find redundant possibilities in adjacent subgrids.
	 * while we may not know the value of n within a grid, we may know
	 * that it exists on a particular row xor column, then by postulate 1
	 * n isn't possible in adjacent grids by row xor column
	 * 
	 * @param gridrow, gridcol {Integer} 1-9
	 * @param byRow {Boolean} if true, implies horizontally adjacent subgrids cannot contain n in row l
	 * @param l {Integer} 1-9 line number of constraint, which may be row xor column number
	 * 
	 * @returns {Array} [{r,c,n}]
	 */
	function findRedundantAdjacentGridPossibilities(gridRow, gridCol, byRow, l, n, G) {
		let b = byRow ? gridCol : gridRow;
		let line = [1,2,3].map(v => { return (3*(b-1)+v) });
		let adjLine = [1,2,3,4,5,6,7,8,9].filter(a => { return line.indexOf(a) === -1});

		let redundantGV = [];

		if (byRow) {
			adjLine.forEach(a => {
				if (G[l][a].indexOf(n) !== -1) {
					redundantGV.push({r:l, c:a, n:n});
				}
			});
		} else {
			adjLine.forEach(a => {
				if (G[a][l].indexOf(n) !== -1) {
					redundantGV.push({r:a, c:l, n:n});
				}
			});
		}
		return redundantGV;
	}
	S.findRedundantAdjacentGridPossibilities = findRedundantAdjacentGridPossibilities;
	
	function test_findRedundantAdjacentGridPossibilities(logOutput) {
		// later, after processing pixels
		let grid = getTestGrid();
		let redundantGV = findRedundantAdjacentGridPossibilities(3, 1, true, 9, 9, grid);

		let t1 = redundantGV.length === 4;
		console.assert(t1, 'failed test_findRedundantAdjacentGridPossibilities redundantGV', redundantGV);
		if (logOutput) { console.log(redundantGV, 'output for test_findRedundantAdjacentGridPossibilities redundantGV') };
	}
	S.test_findRedundantAdjacentGridPossibilities = test_findRedundantAdjacentGridPossibilities;

	/**
	 * find all occurances of n in a 3x3 subgrid
	 * 
	 * @param gridrow, gridcol int {1,2,3}: the subgrid row e.g. 2 => absolute grid rows [4,5,6]
	 * @returns P Array of positions {[{r, c, n}], {e: boolean, }  
	 */
	function findSubgridPossibilities(gridrow, gridcol, n, G) {
		let rows = [1,2,3].map( v => { return (3*(gridrow-1) + v) });
		let cols = [1,2,3].map( v => { return (3*(gridcol-1) + v) });

		// if (gridrow === 2 && gridcol === 2 && n === 1) { debugger };
		
		let p = []; // possibilities remaining
		let solved = false; // has subgrid been solved for n
		rows.forEach(r => {
			cols.forEach(c => {
				if (G[r][c].indexOf(n) !== -1) {
					p.push({r: r, c: c, n: n});
					// subgrid has been solved for n already
					if (G[r][c].length === 1) {
						solved = true;
					}
				}
			});
		});
		// todo: handle p.length === 1, G[p[0].r][p[0].c].length > 1
		/**
		 * if p.length === 1 => a single possibility remains for n
		 * if G[r][c].indexOf(n) === 1 => 
		 */
		return {p:p, solved:solved};
	}
	S.findSubgridPossibilities = findSubgridPossibilities;

	function test_findSubgridPossibilities(logOutput) {
		let G = getTestGrid();
		let p1 = findSubgridPossibilities(3, 2, 6, G);
		let t1 = (p1.p.length === 6) && (p1.solved); // this is pre-removal
		console.assert(t1, 't1 failed at test_findSubgridPossibilities, p1:', p1);
		if (logOutput) { console.log(p1, 'output for test_findSubgridPossibilities t1')}
	}
	S.test_findSubgridPossibilities = test_findSubgridPossibilities;

	// function findSubgridConstraints(gridrow, gridcol, n, G) {

	// }

	// UTILITY METHODS
	/**
	 * Checks whether items in array @nP are linear
	 * @param nP Array [{r, c}, ...]
	 * @returns object {status: boolean, byRow: boolean} : byRow indicates direction if linear
	 */
	function isPossibilitiesLinear(nP) {
		let rowSame = nP.reduce((x,y) => {
			return (x.r === y.r) ? y : false;		
		});
		if (rowSame) {
			return {result: true, byRow: true};
		} else {
			let colSame = nP.reduce((x,y) => {
				return (x.c === y.c) ? y : false;
			});
			if (colSame) {
				return {result: true, byRow: false};			
			} else {
				return {result: false};			
			}
		}
	}

	function test_isPossibilitiesLinear() {
		let t1 = isPossibilitiesLinear([{r:1,c:1},{r:2,c:1},{r:3,c:1}]);
		console.assert((t1.result===true)&&(t1.byRow===false), 't1 test_arePossibilitiesLinear failed', t1);

		let t2 = isPossibilitiesLinear([{r:1,c:1},{r:1,c:3},{r:1,c:1}]);
		console.assert((t2.result===true)&&(t2.byRow===true), 't2 test_arePossibilitiesLinear failed', t2);
		
		let t3 = isPossibilitiesLinear([{r:1,c:1},{r:2,c:3}]);
		console.assert((t3.result===false), 't3 test_arePossibilitiesLinear failed', t3);
	}

	/**
	 * check whether G(i,j) = [n]
	 */
	function isSolved (i, j, G) {
		let s = G[i][j].length === 1;
		let n = s ? G[i][j][0] : false;
		return {solved: s, n: n};
	}
	S.isSolved = isSolved;

	function test_isSolved(logOutput) {
		let grid = getTestGrid();
		let c1 = isSolved(1, 1, grid);
		let t1 = !c1.solved && !c1.n;
		console.assert(t1, 'failed t1 at test_isSolved: ', t1);
		let c2 = isSolved(8, 9, grid);
		let t2 = c2.solved && (c2.n === 2);
		console.assert(t2, 'failed t2 at test_isSolved: ', t2);
		if (logOutput) { console.log({c1, c2}) };
	}
	S.test_isSolved = isSolved;

	/**
	 * 
	 * @returns {Number} of outstanding numbers to be found
	 */
	function countRemainingSolutions(G) {
		let countSolved = 0;
		let d = [1,2,3,4,5,6,7,8,9];

		d.forEach(i => {
			d.forEach(j => {
				if (G[i][j].length === 1) { countSolved += 1;}
			});
		});

		return ((9*9)-countSolved);
	}
	S.countRemainingSolutions = countRemainingSolutions;

	function test_countRemainingSolutions() {
		let grid = getTestGrid();
		let c = countRemainingSolutions(grid);
		console.assert( c===55, 'failed test_countRemainingSolutions, expected 55 but got', c);
	}
	S.test_countRemainingSolutions = test_countRemainingSolutions;
	/**
	 * 
	 * removes possibility n from grid G(i,j)
	 * 
	 * @returns {Object} {G, fail, removed} : fail indicates the attempted 
	 * 	removal of the only possibility, removed indicates whether the possibility was removed from G or not
	 */
	function removeSinglePossibility(i,j,n,G) {
		let copyValues = G[i][j].slice();
		let removeIndex = G[i][j].indexOf(n);

		let fail = ((removeIndex !== -1) && (G[i][j].length === 1));
		console.assert(!fail, 'failed to removeSinglePossibility from Grid G[i][j]', G[i][j], 'where (i,j,n) =', i,j,n);

		if (fail) {
			debugger;
			return ({G:G, error:fail, removed: false});
		}
		else if (removeIndex !== -1) {
			copyValues.splice(removeIndex,1);
			G[i][j] = copyValues;
			return ({G:G, error:fail, removed: true});
		} else {
			return ({G:G, error:fail, removed: false});			
		}
	}
	S.removeSinglePossibility = removeSinglePossibility;

	function test_removeSinglePossibility(renderOnDone) {
		let grid = getTestGrid();

		let r=1;
		let c=2;
		let n=4;

		let gridRemoved = removeSinglePossibility(r,c,n,grid);
		console.assert(gridRemoved.G[r][c].indexOf(n) === -1, 'did not remove item n=', n, 'from grid', grid);
		if (renderOnDone) { renderGrid(grid); }
	}
	S.test_removeSinglePossibility = test_removeSinglePossibility;

	/**
	 * remove all toBeRemoved possibilities from G and push to hasBeenRemoved
	 * 
	 * @returns {Object} {G. hasBeenRemoved, G, error, countRemoved}
	 */
	function flushToBeRemoved(toBeRemoved, hasBeenRemoved, G) {
		let countRemoved = 0;
		for(i=0; i<toBeRemoved.length; i++) {
			let p = toBeRemoved[i];
			let tryRemove = removeSinglePossibility(p.r, p.c, p.n, G);
			// if we try removing something we shouldn't
			if (tryRemove.error) {
				return {G: tryRemove.G, hasBeenRemoved: hasBeenRemoved, error: true};
			} else {
				// no errors
				if (tryRemove.removed) {
					hasBeenRemoved.push(p);
					countRemoved += 1;
				} else {
					// did not remove, and no error
				}
			}
		}

		return ({hasBeenRemoved: hasBeenRemoved, G: G, error: false, countRemoved: countRemoved});
	}
	S.flushToBeRemoved = flushToBeRemoved;

	function test_flushToBeRemoved() {
		let grid = getTestGrid();
		let toBeRemoved = [{r:1,c:1,n:1}, {r:1,c:2,n:5}];
		let hasBeenRemoved = [];
		let flush = flushToBeRemoved(toBeRemoved, hasBeenRemoved, grid);
		let t1 = (flush.hasBeenRemoved.length === 2) && (flush.G[1][1].indexOf(1) === -1);
		console.assert(t1, 'failed test_flushToBeRemoved t1', flush);
	}
	S.test_flushToBeRemoved = test_flushToBeRemoved;

	function getTestGrid(difficulty) {
		let input = [];
		switch (difficulty) {
			case "evil1":
				// http://www.websudoku.com/?level=4&set_id=5056738353
				input = [
					{i: 1, j: 3, v: 5},
					{i: 1, j: 4, v: 6},
					{i: 2, j: 1, v: 9},
					{i: 2, j: 4, v: 5},
					{i: 2, j: 7, v: 7},
					{i: 2, j: 8, v: 3},
					{i: 3, j: 5, v: 1},
					{i: 3, j: 6, v: 4},
					{i: 4, j: 2, v: 8},
					{i: 4, j: 3, v: 7},
					{i: 4, j: 9, v: 6},
					{i: 5, j: 3, v: 6},
					{i: 5, j: 4, v: 8},
					{i: 5, j: 6, v: 2},
					{i: 5, j: 7, v: 9},
					{i: 6, j: 1, v: 5},
					// {i: 6, j: 4, v: 3}, // not in original problem
					{i: 6, j: 7, v: 3},
					{i: 6, j: 8, v: 1},
					{i: 7, j: 4, v: 9},
					{i: 7, j: 5, v: 6},
					{i: 8, j: 2, v: 7},
					{i: 8, j: 3, v: 8},
					{i: 8, j: 6, v: 1},
					{i: 8, j: 9, v: 2},
					{i: 9, j: 6, v: 7},
					{i: 9, j: 7, v: 4},
				];
				break;
			case "evil2":
				// http://www.websudoku.com/?level=4&set_id=5056738353
				input = [
						{i: 1, j: 3, v: 5},
						{i: 1, j: 4, v: 6},
						// {i: 1, j: 9, v: 1}, // solved

						{i: 2, j: 1, v: 9},
						{i: 2, j: 4, v: 5},
						{i: 2, j: 7, v: 7},
						{i: 2, j: 8, v: 3},
						// {i: 2, j: 3, v: 1}, // solved

						{i: 3, j: 5, v: 1},
						{i: 3, j: 6, v: 4},

						{i: 4, j: 2, v: 8},
						{i: 4, j: 3, v: 7},
						{i: 4, j: 9, v: 6},

						{i: 5, j: 3, v: 6},
						{i: 5, j: 4, v: 8},
						{i: 5, j: 6, v: 2},
						{i: 5, j: 7, v: 9},

						{i: 6, j: 1, v: 5},
						{i: 6, j: 7, v: 3},
						{i: 6, j: 8, v: 1},

						{i: 7, j: 4, v: 9},
						{i: 7, j: 5, v: 6},

						{i: 8, j: 2, v: 7},
						{i: 8, j: 3, v: 8},
						{i: 8, j: 6, v: 1},
						{i: 8, j: 9, v: 2},
						// {i: 8, j: 4, v: 3}, // solved

						{i: 9, j: 6, v: 7},
						{i: 9, j: 7, v: 4},
						// {i: 9, j: 8, v: 6}, // solved
				];
				break;
			case "hard":
				// http://www.websudoku.com/?level=3&set_id=3358713602
				input = [
					{i: 1, j: 1, v: 4},
					{i: 1, j: 2, v: 6},
					{i: 1, j: 6, v: 1},
					{i: 1, j: 7, v: 5},

					{i: 2, j: 6, v: 3},
					{i: 2, j: 9, v: 6},

					{i: 3, j: 1, v: 5},
					{i: 3, j: 3, v: 1},
					{i: 3, j: 4, v: 7},

					{i: 4, j: 1, v: 9},
					{i: 4, j: 8, v: 6},

					{i: 5, j: 1, v: 8},
					{i: 5, j: 3, v: 7},
					{i: 5, j: 5, v: 9},
					{i: 5, j: 7, v: 4},
					{i: 5, j: 9, v: 3},

					{i: 6, j: 2, v: 5},
					{i: 6, j: 9, v: 2},

					{i: 7, j: 6, v: 4},
					{i: 7, j: 7, v: 1},
					{i: 7, j: 9, v: 7},

					{i: 8, j: 1, v: 3},
					{i: 8, j: 4, v: 1},

					{i: 9, j: 3, v: 9},
					{i: 9, j: 4, v: 8},
					{i: 9, j: 8, v: 3},
					{i: 9, j: 9, v: 5},					
				];
				break;
			case "easy":
				// http://www.websudoku.com/?level=1&set_id=5652623571
				input = [
					{i: 1, j: 1, v: 7},
					{i: 1, j: 4, v: 2},
					{i: 1, j: 6, v: 5},
					{i: 1, j: 7, v: 1},
					{i: 1, j: 8, v: 9},

					{i: 2, j: 1, v: 3},
					{i: 2, j: 2, v: 1},
					{i: 2, j: 6, v: 8},
					{i: 2, j: 7, v: 5},
					{i: 2, j: 9, v: 4},
					
					{i: 3, j: 1, v: 5},
					{i: 3, j: 3, v: 2},
					{i: 3, j: 5, v: 9},
					{i: 3, j: 8, v: 3},
					
					{i: 4, j: 2, v: 3},
					{i: 4, j: 7, v: 4},
					
					{i: 5, j: 1, v: 6},
					{i: 5, j: 3, v: 1},
					{i: 5, j: 7, v: 3},
					{i: 5, j: 9, v: 9},
					
					{i: 6, j: 3, v: 4},
					{i: 6, j: 8, v: 6},
					
					{i: 7, j: 2, v: 9},
					{i: 7, j: 5, v: 7},
					{i: 7, j: 7, v: 2},
					{i: 7, j: 9, v: 5},
					
					{i: 8, j: 1, v: 1},
					{i: 8, j: 3, v: 7},
					{i: 8, j: 4, v: 9},
					{i: 8, j: 8, v: 4},
					{i: 8, j: 9, v: 6},
					
					{i: 9, j: 2, v: 6},
					{i: 9, j: 3, v: 5},
					{i: 9, j: 4, v: 1},
					{i: 9, j: 6, v: 2},
					{i: 9, j: 9, v: 3},
				]
				break;
			default:
				// http://www.websudoku.com/?level=4&set_id=5056738353
				input = [
					{i: 1, j: 3, v: 5},
					{i: 1, j: 4, v: 6},
					{i: 2, j: 1, v: 9},
					{i: 2, j: 4, v: 5},
					{i: 2, j: 7, v: 7},
					{i: 2, j: 8, v: 3},
					{i: 3, j: 5, v: 1},
					{i: 3, j: 6, v: 4},
					{i: 4, j: 2, v: 8},
					{i: 4, j: 3, v: 7},
					{i: 4, j: 9, v: 6},
					{i: 5, j: 3, v: 6},
					{i: 5, j: 4, v: 8},
					{i: 5, j: 6, v: 2},
					{i: 5, j: 7, v: 9},
					{i: 6, j: 1, v: 5},
					// {i: 6, j: 4, v: 3}, // not in original problem
					{i: 6, j: 7, v: 3},
					{i: 6, j: 8, v: 1},
					{i: 7, j: 4, v: 9},
					{i: 7, j: 5, v: 6},
					{i: 8, j: 2, v: 7},
					{i: 8, j: 3, v: 8},
					{i: 8, j: 6, v: 1},
					{i: 8, j: 9, v: 2},
					{i: 9, j: 6, v: 7},
					{i: 9, j: 7, v: 4},
				];
				break;
		}

		// setup test grid
		let testGrid = {};
		let arr = [1,2,3,4,5,6,7,8,9];

		arr.forEach((a, i, arr) => {
			testGrid[a] = {1: arr, 2: arr, 3: arr, 4: arr, 5: arr, 6: arr, 7: arr, 8: arr, 9: arr};
		});

		// reduce grid for known values
		input.map(v => {
			testGrid[v.i][v.j] = [v.v];
		});
		return testGrid;
	}
	S.getTestGrid = getTestGrid;

	/**
	 * methods to display output as html
	 */
	function renderGrid(G) {
		let grid = G || getTestGrid();
		let d = [1,2,3,4,5,6,7,8,9];
		d.forEach(r => {
			d.forEach(c => {
				let id = r.toString() + c.toString();
				let cellId = 'cell' + r.toString() + c.toString();
				// todo: add css class for starting values
				let value = (grid[r][c].length === 1) ? "<div class='solved' id='" + cellId + "'>" + grid[r][c] + "</div>"
					: "<div class='unsolved' id='" + cellId + "'>"+ grid[r][c] + '</div>';
				document.getElementById(id).innerHTML = value;
			})
		})
	}
	S.renderGrid = renderGrid; // open access to renderGrid function via global S

	function renderGridTemplate() {
		let table = "<table class='table'>";
		let d = [1,2,3,4,5,6,7,8,9];
		d.forEach(r => {
			table+='<tr>';
			d.forEach(c => {
				let id = r.toString() + c.toString();
				table+="<td class='td' id='" + id + "'></td>";
			})
			table+='</tr>';		
		});
		document.getElementById('grid').innerHTML = table;
	}

	/**
	 * make the grid the user sees editable with textboxes in each cell
	 */
	function renderEditMode() {
		// render solve action
		let aDiv = document.getElementById('action');
		// overwrite innerHTML
		let action = "<span><div class='solveComment'>Enter the problem</div><div class='sButton' onclick='S.generateProblem()'>Generate sample</div><div class='sButton' onclick='S.solveInputProblem()'>Solve it</div></span>";
		aDiv.innerHTML = action;
		// render editable grid
		let d = [1,2,3,4,5,6,7,8,9];
		d.forEach( r => {
			d.forEach( c => {
				let id = r.toString() + c.toString();
				let cellId = 'cell' + id;
				let cell = document.getElementById(cellId);
				// remove cell
				let parent = document.getElementById(id);
				try {
					parent.removeChild(cell);					
				} catch (error) {
					// 
				}
				// add input field
				let input = document.createElement("input");
				input.id = 'input' + id;
				input.type = "number";
				input.className = "inputNumber"; // set the CSS class
				parent.appendChild(input); // put it into the DOM
			})
		})
		S.editMode = true;
	}
	S.renderEditMode = renderEditMode;

	function test_renderEditMode() {
		renderEditMode();
		let t1 = document.getElementById('input11');
		console.assert(t1, "failed test_renderEditMode. Could not find elem with id='input11'", t1);
	}


	/**
	 * @returns {Object} {G: Object, validation: Object, starting: Array} : 
	 * 	G grid, error is due to bad input e.g. n>9, starting is the set of starting numbers given encoded 'cellij'
	 */
	function inputToGrid() {
		let grid = {};		
		let validation = {error: false, inputId: ''}; // errorCell e.g. "input15"
		let starting = [];

		let d = [1,2,3,4,5,6,7,8,9];
		// valid input: no values, v==="", or a number from 1-9		
		function isValid(id) {
			let reg = new RegExp('^[1-9]$');
			let v = document.getElementById(id).value;
			// user entered value between 1-9
			if (reg.test(v)) {
				return {value: v, valid: true};
			}
			// no input
			else if (v.length===0) {
				return {value: false, valid: true}
			}
			// invalid input
			else {
				return {value: false, valid: false}
			}
		}

		for (let r=1; r<10; r++) {
			grid[r] = {};
			for (let c=1; c<10; c++) {
				let id = 'input' + r.toString() + c.toString();
				let check = isValid(id);
				// input error
				if (!check.valid) {
					validation = {error: true, inputId: 'input' + r.toString() + c.toString()};
					return {G: grid, validation: validation}; 
				} // user provided valid cell number
				else if (check.valid && check.value) {
					grid[r][c] = [Number(check.value)];
					starting.push('cell' + r.toString() + c.toString()); // toString to simplify checking which cells are solved
				} else { // no input - take all possibilities to begin with
					grid[r][c] = d;
				}
			}
		}
		// console.log('grid', grid);
		return {G: grid, validation: validation, starting: starting};
	}
	S.inputToGrid = inputToGrid;

	function renderGrid2(G, validation, starting) {
		// input error, render it with the css error class
		if (validation.error) {
			document.getElementById(validation.inputId).className += " error";
		} else {
			// no errors
			let d = [1,2,3,4,5,6,7,8,9];
			d.forEach(r => {
				d.forEach(c => {
					let id = r.toString() + c.toString();
					let cellId = 'cell' + r.toString() + c.toString();
					// todo: add css class for starting values
					let startingCss = (starting.indexOf(cellId) !== -1) ? 'starting' : '';
					let value = (G[r][c].length === 1) ? "<div class='solved " + startingCss + "' id='" + cellId + "'>" + G[r][c] + "</div>"
						: "<div class='unsolved' id='" + cellId + "'>"+ G[r][c] + '</div>';
					document.getElementById(id).innerHTML = value;
				});
			});
		}
	}
	S.renderGrid2 = renderGrid2;


	/**
	 * checks whether a possibility p has been removed
	 * @param p {Object} {r, c, n}
	 * @param hasBeenRemoved {Array} [..., {r, c, n}]
	 * @returns {Integer} the index of p in hasBeenRemoved, or -1 if it doesn't
	 */
	function isRemoved(p, hasBeenRemoved) {
		let index = -1; // return value
		hasBeenRemoved.map((r, i) => {
			if ((p.r === r.r) && (p.c === r.c) && (p.n === r.n)) {
				index = i;
			}
		});
		return index;
	}

	function test_isRemoved() {
		let p1 = {r:1, c:2, n:6};
		let p2 = {r:1, c:7, n:8};
		
		let hasBeenRemoved = [
			{r: 1, c: 1, n: 2},
			{r: 1, c: 2, n: 6},
		];

		let t1 = isRemoved(p1, hasBeenRemoved);
		let t2 = isRemoved(p2, hasBeenRemoved);

		console.assert((t1 === 1), 'failed test t1 test_isRemoved', t1);
		console.assert((t2 === -1), 'failed test t2 test_isRemoved', t2);
	}
	S.test_isRemoved = test_isRemoved;

	/**
	 * for evil problems, it's not enough to use the 3 fold algorithms
	 * 	> findRedundantLinearPossibilities
	 * 	> findRedundantBoxPossibilities
	 * 	> findRedundantAdjacentGridPossibilities
	 * 
	 * in these cases, guess at a solution (a solution from 2 available is the simplest)
	 * 
	 * @returns {Array} [{r, c, n}, ...] of first G(i,j) containing 2 solutions
	 */
	function getBinarySolutionPosition(G) {
		let cell = {};
		let found = false;
		let guess = [];

		for (i=1;i<10;i++) {
			for (j=1;j<10;j++) {
				if (G[i][j].length === 2) {
					found = true;
					cell = {i: i, j: j};
					guess = G[i][j].map(v => {
						return {r: i, c: j, n: v};
					});
					return guess;
				}
			}
		}
		return false;
	}

	function test_getBinarySolutionPosition(logOutput) {
		let grid = getTestGrid();
		grid[2][3] = [1,4];
		grid[3][7] = [2,5];
		grid[1][1] = [1,2,3,4,7,8];
		let p = getBinarySolutionPosition(grid)[0];
		let t1 = (p.r === 2) && (p.c === 3);
		console.assert(t1, 'failed test_getBinarySolutionPosition t1', p);
		if (logOutput) { console.log(p, 'test_getBinarySolutionPosition');};
	}

	/**
	 * Algorithm order
	 * 
	 * set Grid based on input
	 * 
	 * Stage 1: remove possibilities based on known numbers
	 * 
	 * for each (i,j) isSolved?
	 * 	> findRedundantLinearPossibilities(i,j,n,G) and concat to toBeRemoved
	 * 	> findRedundantBoxPossibilities(i,j,n,G) and concat to toBeRemoved
	 * 	> removeSinglePossibility from all toBeRemoved, add to hasBeenRemoved
	 * 
	 * Stage 2: remove constraints iteratively
	 * 
	 * cycles = 0;
	 * possibilitiesRemoved = 0;
	 * 
	 * while (!stop) {
	 * increment cycle
	 * 
	 * for each n, for each (i,j)
	 * 	> findSubgridPossibilities(i,j,n,G)
	 * 		> single possibility?
	 * 			findRedundantLinearPossibilities(i,j,n,G) add to toBeRemoved if not already in hasBeenRemoved
	 * 			findRedundantBoxPossibilities(i,j,n,G) add to toBeRemoved if not already in hasBeenRemoved
	 * 			
	 * 				increment possibilitiesRemoved by hasBeenRemoved // should this function be embedded into removeSinglePossibility? yes...
	 * 				// but how to keep it pure? S.progress = {1, 2, 3, 4, ...} // S.progress[cycleNumber] = possibilitiesRemoved
	 * 		> else if isPossibilitiesLinear? findRedundantAdjacentGridPossibilities and add to toBeRemoved, if not already in hasBeenRemoved
	 * 		> removeSinglePossibility from all toBeRemoved, add to hasBeenRemoved
	 * 
	 * 	> if no progress made in this cycle (all n, i, j), then stop
	 *  	> completed?
	 * 		> incomplete -> error
	 * }
	 * 
	 * todo: decide where to store: stop, progress, toBeRemoved, hasBeenRemoved
	 * 	is Stage 1 necessary? if not, simplify the code and only run cycles
	 */

	/**
	 * iterates through grid G. If G(i,j) is solved, then find redundant
	 * 	linear and subgrid box possibilities and try removing them
	 * 
	 * @returns {Object} {G, error} : error due to removeSinglePossibility failing
	 */
	function removePossibilitiesForSolvedNumbers(G) {
		let d = [1,2,3,4,5,6,7,8,9];
		let countRemoved = 0;

		for (let i=1;i<10;i++) {
			for (let j=1;j<10;j++) {
				if (G[i][j].length === 1) {
					let rlP = findRedundantLinearPossibilities(i,j,G[i][j][0],G);
					// redundant box possibilities
					let rbP = findRedundantBoxPossibilities(i,j,G[i][j][0],G);
					// add toBeRemoved
					rlP.forEach(v => { S.toBeRemoved.push(v); }); // todo: are these side affects okay?
					rbP.forEach(v => { S.toBeRemoved.push(v); });

					let flushRedudantPossibilities = flushToBeRemoved(S.toBeRemoved, S.hasBeenRemoved, G);
					if (flushRedudantPossibilities.error) {
						return {G:G, error: true};						
					} else {
						countRemoved += flushRedudantPossibilities.countRemoved;
						S.toBeRemoved = [];
						S.hasBeenRemoved = flushRedudantPossibilities.hasBeenRemoved;
						G = flushRedudantPossibilities.G;
					}
				}
			}
		}
		return {G:G, error: false, countRemoved: countRemoved};
	}
	S.removePossibilitiesForSolvedNumbers = removePossibilitiesForSolvedNumbers;

	/**
	 * core algorithm for finding unique possibilities and removing redundant ones
	 * cycles for all n, and subgrid boxes [1,2,3] and based on subgrid possibilities the following occur:
	 * > case 1: unique possibility is found, remove it and remove implied redudant linear/box possibilities
	 * > case 2: a linear constraint is implied e.g. if number 8 can only exist on row 5 for subgrid (2,2), then n=8 cannot exist on row 5 in adjacent subgrids (2,1) (2,3)
	 * > case 3: no obvious constraints are found, skip
	 * 
	 * @returns {Object} {G, error, countRemoved} : error - due to removeSinglePossibility failing, 
	 * 	countRemoved: number of possibilities removed
	 */
	function cycle(G) {
		let b = [1,2,3];
		let d = [1,2,3,4,5,6,7,8,9];
		let countRemoved = 0;

		for (let n=1;n<10;n++) {
			for (let gr=1; gr<4; gr++) {
				for (let gc=1; gc<4; gc++) {
					//subgrid possibilties
					// p is the place holder for the first possibility {r,c,n}
					let gP = findSubgridPossibilities(gr, gc, n, G);
					let p = gP.p[0];
					// case 1: unique solution found
					if (!gP.solved && gP.p.length === 1) {
						// the unique solution has not been 'flattened' to remove redudant possibilties
						// e.g. G(i,j)=[1,2,3] but within gridbox (1,1), there remains only one possibility for n=2 therefore G(i,j)=[2]
						if (G[p.r][p.c].length > 1) {
							// mark answer in grid for n
							G[p.r][p.c] = [p.n];
							countRemoved += 1;

							// find redundant linear possibilities
							let rlP = findRedundantLinearPossibilities(p.r, p.c, p.n, G);
							// find redundant box possibilities
							let rbP = findRedundantBoxPossibilities(p.r, p.c, p.n, G);
							// queue toBeRemoved
							rlP.forEach(v => { S.toBeRemoved.push(v); }); // todo: are these side affects okay?
							rbP.forEach(v => { S.toBeRemoved.push(v); });

							// remove possibilities from G
							// if there are errors here, it's because there's a contradiction (such as removing all possibilities from a cell)
							let flushRedudantPossibilities = flushToBeRemoved(S.toBeRemoved, S.hasBeenRemoved, G);
							// errors arise in the case of incorrect guesses
							if (flushRedudantPossibilities.error) {
								return {G: flushRedudantPossibilities.G, error: true, countRemoved: countRemoved};
							} else {
								countRemoved += flushRedudantPossibilities.countRemoved;
								S.toBeRemoved = [];
								S.hasBeenRemoved = flushRedudantPossibilities.hasBeenRemoved;
								G = flushRedudantPossibilities.G;
							}
						}
					}
					// case 2: check if possibilities imply a linear constraint
					else {
						let isLinear = isPossibilitiesLinear(gP.p);
						// is linear
						if (isLinear.result) {
							let l = isLinear.byRow ? p.r : p.c;
							let abP = findRedundantAdjacentGridPossibilities(gr, gc, isLinear.byRow, l, p.n, G);
							abP.forEach(v => { S.toBeRemoved.push(v); });
							
							let flushRedudantPossibilities = flushToBeRemoved(S.toBeRemoved, S.hasBeenRemoved, G);
							if (flushRedudantPossibilities.error) {
								return {G: flushRedudantPossibilities.G, error: true};
							} else {
								countRemoved += flushRedudantPossibilities.countRemoved;								
								S.toBeRemoved = [];
								S.hasBeenRemoved = flushRedudantPossibilities.hasBeenRemoved;
								G = flushRedudantPossibilities.G;
							}
						}
					}
				}
			}
		}
		return {G:G, error: false, countRemoved: countRemoved};
	}
	S.cycle = cycle;

/**
 * solves the sudoku problem by controlling the flow between cycles (above function),
 * 	to only run if we can make progress and make educated guesses when required and if those guesses fail, rollback
 * 	to the last safe core algorithm cycle and make another guess. Usually only a couple at max are required for
 * 	the tough problems
 * 
 * 	 @returns {Object} { cycle: C, cycleCount: number, stop: boolean, solved: boolean}
 */
	function solveProblem(G) {
		// the solution loop will run until stopped, triggered when a solution is found, or something goes horribly wrong
		let stop = false;
		let cycleCount = 0;
		// for evil grids, we may need to guess at a solution, if it fails then revert to previous successful run		
		let preGuessCycle = {};
		// keep track of which guesses have been attempted and ones to attempt next if required
		// e.g. cycle makes no further progress (countRemoved===0), grid is not solved, and 
		let guessMode = false;
		let guessed = [];
		let nextGuess = [];
		let solved = false;		
		// hold cycle outside closure so it can be returned
		let C = {};

		// start by removing all starting numbers, and the constraints they imply; linear and subgrid
		G = removePossibilitiesForSolvedNumbers(G).G;		

		while (!stop) {
			cycleCount += 1;
			C = cycle(G);

			// core algorithms broke..halt the cycle...broke due to bad guess
			if (C.error) { 
				console.warn('problem running core algorithms: C.error', C);
				stop = true;
			}

			// further solutions may be revealed after removing possibilities
			// check whether new unique possibilities exist, if so remove linear and box possibilities 
			if (C.countRemoved > 0) {
				let removeKnown = removePossibilitiesForSolvedNumbers(C.G);
				if (removeKnown.error) {
					// move to next guess and rollback grid					
					if (guessMode) {
						// rollback to Grid pre guess
						console.warn('rolling back grid to preGuessCycle: ', preGuessCycle);
						C = preGuessCycle;
						if (nextGuess.length === 0) {
							nextGuess = getBinarySolutionPosition(C.G);
						}

						let s = nextGuess[nextGuess.length-1];
						C.countRemoved += C.G[s.r][s.c].length -1;
						C.G[s.r][s.c] = [s.n];
						guessed.push(nextGuess[nextGuess.length-1]);
						nextGuess.pop();
					}
					stop = true;
				} else {
					C.G = removeKnown.G;
					C.countRemoved += removeKnown.countRemoved;

				}
			}
			// no progress was made this cycle (no possibilities were removed)
			// e.g. we might have solved the problem or the cycle algorithms aren't enough for the evil problems
			// 	so make the best guess we can, and if it fails, rollback to the preGuessCycle and make another guess
			else {
				// have we solved the problem?!
				if (countRemainingSolutions(C.G) === 0) {
					console.log('hurrah - the problem has been solved!');
					solved = true;
					stop = true;
				}  else {
					// stop = true;

					// // no progress made in this cycle. Fiendish problems may not be solvable using
					// // algorithms within cycle alone
					// // make a guess, if it fails, rewind to last successful cycle
					if (nextGuess.length === 0) { 
						nextGuess = getBinarySolutionPosition(C.G);
					}
					// line up the next guess
					let s = nextGuess[nextGuess.length-1];

					if (!guessMode) {
						guessMode = true;
						// save the progress made by running the standard algorithms by cycle
						preGuessCycle = C;
						console.warn('... first guess:', s);
					}
					else {
						// reset to preGuessCycle
						console.warn('... making another guess:', s);						
						C = preGuessCycle;
					}

					// since we're assuming a number, reduce the count of the remaining possibilities
					C.countRemoved += C.G[s.r][s.c].length -1;
					C.G[s.r][s.c] = [s.n];
					guessed.push(nextGuess[nextGuess.length-1]);
					nextGuess.pop();
				}
			}
		}
		return { cycle: C, cycleCount: cycleCount, stop: stop, solved: solved};
	}
	S.solveProblem = solveProblem;

	function solveInputProblem() {
		let GV = inputToGrid();
		renderGrid2(GV.G, GV.validation, GV.starting);
		
		if (GV.validation.error) { return false };
		let S = solveProblem(GV.G);
		renderGrid2(S.cycle.G, GV.validation, GV.starting);

		let action = S.solved ?  "<span><div class='solveComment'>hurrah! Another one bites the dust</div><div class='sButton' onclick='S.renderEditMode()'>Try another</div></span>"
			: "<span><div class='solveComment'>hmm...that stumped me, you sure you entered the grid okay to begin with? </div><div class='sButton' onclick='S.renderEditMode()'>Try again</div></span>";
		let aDiv = document.getElementById('action');
		aDiv.innerHTML = action;
	}
	S.solveInputProblem = solveInputProblem;

	function generateTestInput(gridType) {
		if (!S.editMode) { renderEditMode(); }
		let grid = getTestGrid(gridType);
		let d = [1,2,3,4,5,6,7,8,9];
		d.forEach( r => {
			d.forEach( c => {
				let inputId = 'input' + r.toString() + c.toString();				
				if (grid[r][c].length === 1) {
					document.getElementById(inputId).value = grid[r][c][0];
				} else {
					document.getElementById(inputId).value = '';					
				}
			});
		});
	}
	S.generateTestInput = generateTestInput;

	function generateProblem() {
		let options = ['evil1', 'hard', 'easy'];
		// Returns a random integer between min (included) and max (included)
		function getRandomInt(min, max) {
			return Math.floor(Math.random() * (max - min + 1)) + min;
		}

		let i = getRandomInt(0, options.length);
		let option = options[i];
		generateTestInput(option);
	}
	S.generateProblem = generateProblem;
	/**
	 * run all tests
	 * 
	 * append tests here
	 */
	function runAllTests(renderOnDone, logOutput) {
		test_findRedundantLinearPossibilities(logOutput);
		test_findRedundantBoxPossibilities(logOutput);
		test_findRedundantAdjacentGridPossibilities(logOutput);
		test_findSubgridPossibilities(logOutput);		
		test_isPossibilitiesLinear();
		test_removeSinglePossibility(renderOnDone);
		test_isSolved(logOutput);
		test_isRemoved();
		test_flushToBeRemoved();
		test_getBinarySolutionPosition(logOutput);
		test_countRemainingSolutions();
		test_renderEditMode();
	}
	S.runAllTests = runAllTests;

	// document is ready, render grid
	renderGridTemplate();
	renderEditMode();
	// initialiseGrid();
	// renderGrid();

	window.S = S; // open access to S, the Sudoku Solver library, from window
})(window);

/**
 * failing sudoku puzzles
 * http://www.websudoku.com/?level=4&set_id=1170319394 evil
 * http://www.websudoku.com/?level=3&set_id=8197842183 hard
 */