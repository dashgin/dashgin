---
title: "S3 Said 27 GB. The Bill Said 73."
description: "46 GB of my bucket was invisible to every tool I had. Here's how S3 object metadata let me reconstruct a silent failure from two months earlier — and the design bug it exposed."
pubDate: 2026-08-15
tags: ["aws", "s3", "debugging", "forensics", "post-mortem"]
draft: false
---

I was checking storage costs on a digital asset manager I'm building. `aws s3 ls` said the bucket held 856 objects totalling **26.7 GB**.

Cost Explorer said I was being billed for **73.2 GB**.

Neither number was wrong. The 46 GB gap had been sitting there for two months, invisible to every tool I normally use, and the story of how it got there turned out to be more interesting than the storage cost — which, for the record, was $1.65 a month. This is not a post about saving money.

## The part of S3 that doesn't show up in listings

When you upload a large file to S3, the client doesn't send it in one request. It calls `CreateMultipartUpload`, gets an upload ID, pushes the file up in chunks, then calls `CompleteMultipartUpload` to stitch them together into an object.

Until that final call lands, the uploaded chunks are real, stored, and **billed** — but they are not an object. `ListObjects` doesn't return them. `aws s3 ls` doesn't see them. The S3 console doesn't show them on the objects tab. They exist in a separate namespace you have to ask for explicitly:

```bash
aws s3api list-multipart-uploads --bucket my-bucket
```

I ran it expecting nothing:

```
incomplete multipart uploads: 47
```

Forty-seven abandoned uploads. All the same 1.06 GB file. All initiated within a **six-second window** on June 6th, at 21:17:59 UTC — 1:18 AM my time. Summing their parts came to **48.3 GB**.

That was the missing storage.

## Now the interesting question

I had the *what*. I had no idea about the *why*. There were no logs — this was a browser upload that died two months ago. No error report, no Sentry event, no server-side trace of the failure. Whatever happened, happened in a tab that no longer existed.

But S3 keeps more metadata than people realise. It turned out to be enough.

### Clue 1: the ETag says which code wrote the object

Alongside the 47 dead uploads, 19 *completed* copies of the same video were sitting in the bucket. All 19 shared an ETag:

```
"b48ab5828a8e25a018b2095f098532d4-212"
```

For a multipart object, S3's ETag isn't the file's MD5. It's a hash of the concatenated part hashes, with **the part count appended after a dash**. That `-212` is a fingerprint of *how the file was uploaded*, not just what it contains.

1.06 GB in 212 parts means 5 MB chunks. My backend hardcodes exactly that:

```python
part_size = 5 * 1024 * 1024  # 5MB minimum for S3
```

The AWS CLI defaults to 8 MB. rclone defaults differently again. That single suffix ruled out "someone ran a CLI command" and pinned every copy to my own application's upload endpoint. I hadn't fat-fingered a script — my app did this.

### Clue 2: the gaps aren't random

`list-parts` tells you which chunks made it. I expected uploads that died at scattered points — that's what a flaky connection looks like.

Instead:

- **21 of 47** had all **212 of 212** parts uploaded.
- **26 of 47** had **210 of 212** — missing *exactly* parts 211 and 212.

Nothing else. No upload stopped at part 47, or 130, or 8.

Twenty-one uploads had every single byte in S3 and were one API call from being finished. The other twenty-six were two chunks short. A network problem doesn't distribute itself like that.

### Clue 3: the 33-second window

Each part carries a `LastModified`. I pulled the newest one from each of the 47 uploads and sorted them:

```
earliest last-write:  2026-06-06T22:05:30Z
latest last-write:    2026-06-06T22:06:03Z
```

Every one of the 47 uploads stopped writing inside the same **33-second window**, after running for about 47 minutes.

That settles it. Forty-seven independent failures don't synchronise to half a minute. This wasn't 47 uploads failing — it was **one thing failing, once**, that all 47 were riding on. The tab was closed, or the machine went to sleep. At 2 AM, I'd bet on sleep.

And the parts still being there two months later proves the rest: **my cleanup code never ran.**

## The code

Here's what the browser was doing. Small files were carefully batched:

```ts
// Small files: batched to avoid oversized requests
for (let i = 0; i < smallFiles.length; i += UPLOAD_URL_BATCH_SIZE) {
  const chunk = smallFiles.slice(i, i + UPLOAD_URL_BATCH_SIZE);
  // ...upload this chunk...
}
```

And immediately below it, large files were not:

```ts
// Large files: multipart upload flow
const largePromises = largeFiles.map(async (file) => {
  const init = await initMultipart(file);      // opens an S3 multipart upload
  const parts = await uploadMultipart(file);   // pushes ~212 chunks
  await completeMultipart(init, parts);        // finalises
});

await Promise.all(largePromises);               // ← every file, all at once
```

Ten lines apart in the same function. One path bounded, the other unbounded.

Select 47 large files and you open 47 concurrent S3 multipart uploads and try to push 48.5 GB through a single browser tab. It ran for 47 minutes and got *almost* all the way — which is its own kind of unlucky.

There *was* per-file cleanup, and it was correct:

```ts
} catch {
  if (fileKey && uploadId) {
    abortMultipart({ fileKey, uploadId }).catch(() => {});
  }
  return null;
}
```

It never executed. Not because it was buggy — because the failure mode was *the thing that runs the catch block ceasing to exist*. There is no exception to catch when the JavaScript context is gone.

One hypothesis I had to kill: presigned URLs expire, and mine were set to 3600 seconds. Tempting. But the uploads died at 47 minutes, comfortably inside the window. Expiry wasn't it.

## The fix, in three layers

**1. A lifecycle rule.** This is the one that actually matters:

```json
{
  "Rules": [{
    "ID": "abort-incomplete-multipart-uploads",
    "Filter": {},
    "Status": "Enabled",
    "AbortIncompleteMultipartUpload": { "DaysAfterInitiation": 7 }
  }]
}
```

Seven lines of JSON. S3 now reaps abandoned uploads on its own, regardless of what any client does or fails to do. If I'd had this from day one, the 46 GB would have cleaned itself up in a week and I'd never have written this post.

**2. Bound the concurrency.** A small worker-pool helper with `Promise.allSettled` semantics:

```ts
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results = new Array<PromiseSettledResult<R>>(items.length);
  let cursor = 0;

  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    for (let index = cursor++; index < items.length; index = cursor++) {
      try {
        results[index] = { status: 'fulfilled', value: await mapper(items[index], index) };
      } catch (reason) {
        results[index] = { status: 'rejected', reason };
      }
    }
  });

  await Promise.all(workers);
  return results;
}
```

Three files at a time instead of all of them. In-flight bytes drop from 48.5 GB to about 45 MB. A dead tab now strands three uploads, not forty-seven.

**3. Abort the existing 47.** Safe, because they could never be completed anyway — finalising a multipart upload requires the part ETags, and those only ever lived in a browser tab that died in June.

## What I'd actually take from this

**Cleanup that lives only in the client's `catch` block is not cleanup.**

My abort code was well-written and correct and completely useless, because it assumed the client would survive long enough to run it. That assumption is invisible when you read the code — it looks like proper error handling. It only shows up when the client is the thing that dies.

This generalises past S3. Anything you acquire remotely and release client-side has the same shape: open database transactions, distributed locks, Stripe payment intents, temp files on a server, reserved inventory. If the only thing that frees the resource is code running on the machine that just crashed, then you don't have cleanup — you have cleanup *most of the time*, and the leaked cases accumulate silently precisely because nothing is around to report them.

The fix is never a better `catch`. It's a reaper on the other side that doesn't care whether your client is alive.

**And the smaller lesson:** the bounded loop and the unbounded one sat ten lines apart in the same file. Both looked fine on their own. I wrote both. I reviewed both. What made it visible in the end wasn't reading the code — it was a number in a billing console that didn't match a number in a file listing.

Reconcile your numbers occasionally. The gap is where the interesting bugs live.

---

*Postscript, for honesty's sake: this was me stress-testing my own upload path with a 10-hour 4K video at 1 AM, not a customer incident. Nobody's data was affected and the total cost of the mistake was about eighteen dollars a year. I'm writing it up because the forensics were fun and the design bug is one I expect to meet again.*
