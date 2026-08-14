# The two pinned adoption failures

Status: needs-info

`adopt.spec` pins two wrong adoptions — an in-slot deletion kills the wrong sibling of two identical marks. The slot recursion's window bound was designed and never implemented. Write the reproduction and the options; flipping those pins is a decision, not a task.
