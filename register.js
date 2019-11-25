const {
  parent
} = module

if (parent) require('.')(parent.path)
else require('.')()
