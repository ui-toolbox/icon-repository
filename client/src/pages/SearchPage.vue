<template>
  <div>
    <header class="top-header">
      <div class="inner-wrapper">
        <div class="branding">
            <app-settings class="app-title"/>
            <div class="app-description">
                <span>{{branding.appDescription}}</span>
            </div>
        </div>
        <div class="right-control-group">
          <div class="search">
            <div class="search-input-wrapper">
              <i class="material-icons search-icon">search</i>
              <input type="text" class="search-input" v-model="searchQuery">
            </div>
          </div>
          <user-settings :user="user"/>
        </div>
      </div>
    </header>

    <div class="action-bar">
      <div class="add-icon" v-if="hasAddIconPrivilege">
        <el-button type="primary" icon="el-icon-plus" @click="createDialogVisible = true">ADD NEW</el-button>
      </div>
    </div>

    <create-icon-dialog
            :iconfileTypes="iconfileTypes"
            :dialogVisible="createDialogVisible"
            @finished="dialogClosed"/>
    <modify-icon-dialog
            v-if="activeIcon"
            :iconfileTypes="iconfileTypes"
            :icon="activeIcon"
            :dialogVisible="modifyIconDialogVisible"
            @finished="dialogClosed"/>
    <icon-details-dialog
            v-if="activeIcon"
            :icon="activeIcon"
            :dialogVisible="iconDetailsDialogVisible"
            @finished="dialogClosed"/>

    <section class="inner-wrapper icon-grid">
      <icon-cell v-for="item in filteredIcons" v-bind:icon="item" :key="item.path"
                :editable="hasUpdateIconPrivilege" @edit="editIcon" @view="viewIcon" class="grid-cell"></icon-cell>
    </section>

  </div>
</template>

<script>
import { getAppInfo, iconfileTypes } from '@/services/config';
import * as userService from '@/services/user';
import getEndpointUrl from '@/services/url';
import AppSettings from '@/components/AppSettings';
import UserSettings from '@/components/UserSettings';
import IconCell from '@/components/icons/IconCell';
import CreateIconDialog from '@/components/icons/CreateIconDialog';
import ModifyIconDialog from '@/components/icons/ModifyIconDialog';
import IconDetailsDialog_1 from '@/components/icons/IconDetailsDialog-1';
import { SUCCESSFUL, CANCELLED, FAILED } from '@/services/constants';

import testIconData from '@/resources/test-icon-data';

export default {
  name: 'SearchPage',
  components: {
    'app-settings': AppSettings,
    'user-settings': UserSettings,
    'icon-cell': IconCell,
    'icon-details-dialog': IconDetailsDialog_1,
    'create-icon-dialog': CreateIconDialog,
    'modify-icon-dialog': ModifyIconDialog
  },
  computed: {
    hasAddIconPrivilege() {
        return userService.hasAddIconPrivilege(this.user);
    },
    hasUpdateIconPrivilege() {
        return userService.hasUpdateIconPrivilege(this.user);
    },
    filteredIcons: function () {
      var self = this;
      if (this.searchQuery=='') {
        return this.icons;
      }
      else {
        return self.icons.filter(function (icon) {
         return icon.name.toLowerCase().indexOf(self.searchQuery.toLowerCase()) !== -1
        })
      }
    }
  },
  created () {
    this.branding = {
        appDescription: getAppInfo().appDescription
    };

    userService.fetchUserInfo()
    .then(
        userinfo => this.user = userinfo,
        error => this.$showErrorMessage(error)
    )
    .then(() => this.loadIcons())
  },
  data () {
    return {
        iconfileTypes,
        branding: {},
        user: userService.initialUserInfo(),
        iconTypes: {},
        icons: [],
        searchQuery: '',
        createDialogVisible: false,
        activeIcon: null,
        iconDetailsDialogVisible: false,
        modifyIconDialogVisible: false
    }
  },
  methods: {
      loadIcons() {
        const iconListUrl = getEndpointUrl('/icons');
        this.$http.get(iconListUrl).then(function(response) {
            this.icons = response.body;
        }, response => {
            if (process.env.NODE_ENV === 'development') {
                this.icons = testIconData;
            } else {
                throw new Error(response);
            }
        })
      },
      editIcon(iconName) {
          this.activeIcon = iconName;
          this.modifyIconDialogVisible = true;
      },
      viewIcon(iconName) {
          this.activeIcon = iconName;
          this.iconDetailsDialogVisible = true;
      },
      dialogClosed(result) {
          this.createDialogVisible = false;
          this.modifyIconDialogVisible = false;
          this.iconDetailsDialogVisible = false;
          this.activeIcon = null;
          if (result.status === SUCCESSFUL) {
              this.loadIcons();
          } else if (result.status === FAILED) {
              this.$showErrorMessage(result.error);
          }
      }
  }
}
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style lang="scss">

$ic-color-action : #FFD999;
$ic-color-gradient-top: #FFA000;
$ic-color-gradient-bottom: #FFBD4D;
$ic-color-text: #455156;
.top-header {
  position: relative;
  height: 80px;
  color: $ic-color-text;
}
.brand-logo {
  fill: $ic-color-text;
}
.inner-wrapper {
  height: auto;
}
.branding {
  position: absolute;
  left: 40px;
  margin: 10px 0;
  .app-title {
    margin-bottom: 10px;
  }
}
.right-control-group {
  position: absolute;
  right: 0;
  .search {
    float: left;
    text-align: center;
    .search-title {
      height: 24px;
      font-size: 20px;
      line-height: 24px;
    }
    .search-input-wrapper {
      margin: 0 auto;
      position: relative;
      input {
        width: 100%;
      }
    }
    .search-icon {
      position: absolute;
      top: 18px;
      left: 10px;
      font-size: 36px;
    }
    .search-input {
      width: 100%;
      border: 4px solid #FFD999;
      border-radius: 26px;
      background-color: #FFFFFF;
      font-size: 20px;
      height: 42px;
      line-height: 48px;
      padding: 0 20px 0 60px;
      color: $ic-color-text;
      margin-top: 15px;
      &:focus {
        outline: none;
      }
    }
  }
  .user-area {
    margin: 15px;
  }
}

.action-bar {
  margin: 50px 60px 50px 30px;

  .add-icon {
    float: right;
    span {
        vertical-align: middle;
    }
  }
}

$icon-grid-size: 160px;
.icon-grid {
  width: 100%;
  display: flex;
  margin: 0 0 0 50px;
  flex-wrap: wrap;
  justify-content: flex-start;
  align-content: flex-start;
  .grid-cell {
    display: block;
    width: $icon-grid-size;
    height: $icon-grid-size;
    margin: 10px;
    flex: 1 0 $icon-grid-size;
    max-width: $icon-grid-size;
  }
}
img {
  vertical-align:middle;
}
a {
  color: #42b983;
}
</style>