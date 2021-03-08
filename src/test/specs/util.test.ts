import assert from 'assert';

import { groupBy, sortBy } from '../../main';

describe('util', () => {

    const records = [
        { name: 'Joe', age: 30, gender: 'male' },
        { name: 'Jane', age: 35, gender: 'female' },
        { name: 'Janice', age: 18, gender: 'female' },
        { name: 'Jennifer', age: 31, gender: 'female' },
    ];

    describe('groupBy', () => {

        it('groups by property', () => {
            const groups = groupBy(records, _ => _.gender);
            assert.equal(groups.length, 2);
            assert.equal(groups[0][0], 'male');
            assert.deepEqual(groups[0][1], [
                { name: 'Joe', age: 30, gender: 'male' }
            ]);

            assert.equal(groups[1][0], 'female');
            assert.deepEqual(groups[1][1], [
                { name: 'Jane', age: 35, gender: 'female' },
                { name: 'Janice', age: 18, gender: 'female' },
                { name: 'Jennifer', age: 31, gender: 'female' },
            ]);
        });

    });

    describe('sortBy', () => {

        it('sorts by property', () => {
            const names = sortBy(records, _ => _.age).map(_ => _.name);
            assert.deepEqual(names, ['Janice', 'Joe', 'Jennifer', 'Jane']);
        });

    });

});
