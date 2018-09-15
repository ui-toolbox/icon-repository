<template>
    <div>
        <el-row class="attribute-label">
            <el-col :span="5"><span>Icon name: </span></el-col>
        </el-row>
        <el-row>
        <el-col class="text-value" :span="24">
                <el-input placeholder="Please specify the icon name" v-model="iconName"/>
            </el-col>
        </el-row>
        <iconfile-attributes
            :iconfileTypes="iconfileTypes"
            :attributes="{fileName, format, size}"
            @change='onAttributeChange'/>
    </div>
</template>

<script>
import IconfileAttributes from '@/components/icons/IconfileAttributes';

export default {
    components: {
        'iconfile-attributes': IconfileAttributes
    },
    props: [
        "iconfileTypes",
        "attributes"
    ],
    data() {
        return {
            iconName: this.attributes.iconName,
            fileName: this.attributes.fileName,
            format: this.attributes.format,
            size: this.attributes.size
        }
    },
    watch: {
        iconName(newValue) {
            this.onAttributeChange({iconName: newValue});
        }
    },
    methods: {
        onAttributeChange(delta) {
            this.$emit('change', Object.assign(this.$data, delta))  ;
        }
    }
}
</script>
        

