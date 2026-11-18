# Third-party data

## name-suggestion-index

`src/data/brands.generated.json` (US store brands for Checkout) is built by
`scripts/build-brands.mjs` from name-suggestion-index 8.0.20261101
(https://github.com/osmlab/name-suggestion-index), licensed BSD-3-Clause:

> Copyright 2026, name-suggestion-index contributors
>
> Redistribution and use in source and binary forms, with or without
> modification, are permitted provided that the following conditions are met:
> 1. Redistributions of source code must retain the above copyright notice,
>    this list of conditions and the following disclaimer.
> 2. Redistributions in binary form must reproduce the above copyright notice,
>    this list of conditions and the following disclaimer in the documentation
>    and/or other materials provided with the distribution.
> 3. Neither the name of the copyright holder nor the names of its
>    contributors may be used to endorse or promote products derived from this
>    software without specific prior written permission.
>
> THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
> AND ANY EXPRESS OR IMPLIED WARRANTIES ARE DISCLAIMED.

## OpenStreetMap (Overpass)

Checkout → Near me asks the public Overpass API for nearby store names
(© OpenStreetMap contributors, ODbL). Only the coordinates the person chose
to share (or a mall's center) are sent, from their browser.
